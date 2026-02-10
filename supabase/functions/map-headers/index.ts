import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://tidyimport.lovable.app",
  "https://id-preview--a33f7270-969b-46bc-9b9e-34263d3ef005.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Input validation
function validateInput(body: unknown): { valid: true; sourceHeaders: string[]; targetHeaders: string[] } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { sourceHeaders, targetHeaders } = body as Record<string, unknown>;

  if (!Array.isArray(sourceHeaders) || !sourceHeaders.every(h => typeof h === "string")) {
    return { valid: false, error: "sourceHeaders must be an array of strings" };
  }
  if (!Array.isArray(targetHeaders) || !targetHeaders.every(h => typeof h === "string")) {
    return { valid: false, error: "targetHeaders must be an array of strings" };
  }
  if (sourceHeaders.length > 200) {
    return { valid: false, error: "sourceHeaders exceeds maximum of 200 items" };
  }
  if (targetHeaders.length > 50) {
    return { valid: false, error: "targetHeaders exceeds maximum of 50 items" };
  }
  if (sourceHeaders.some(h => h.length > 100) || targetHeaders.some(h => h.length > 100)) {
    return { valid: false, error: "Header strings must be 100 characters or less" };
  }

  return { valid: true, sourceHeaders, targetHeaders };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: verify apikey header or Authorization Bearer matches anon key
    const apikey = req.headers.get("apikey");
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const expectedKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!expectedKey || (apikey !== expectedKey && bearerToken !== expectedKey)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("cf-connecting-ip") || 
               "unknown";
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateInput(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sourceHeaders, targetHeaders } = validation;

    // Audit log (no PII - just metadata)
    console.log(JSON.stringify({
      event: "map-headers-request",
      ip,
      sourceHeaderCount: sourceHeaders.length,
      targetHeaderCount: targetHeaders.length,
      timestamp: new Date().toISOString(),
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

const systemPrompt = `You are an expert data mapping assistant for CRM imports. Your job is to intelligently map source column headers to vcita's target CRM column headers, detect address component columns, AND detect combined name columns that need splitting.

Target CRM Headers (exact names):
${targetHeaders.join(", ")}

vcita Field Requirements:
- "Email": Email addresses for client contact
- "First Name": REQUIRED - Client's first/given name
- "Last Name": Client's surname/family name
- "Phone": Client phone number (will be formatted as 555-555-5555)
- "Address": Combined full address (street, city, state, zip in one field)
- "Birthday": Date of birth (MM/DD/YYYY format)
- "Time Zone": Must be valid timezone like US/Eastern, US/Central, US/Mountain, US/Pacific
- "Status": Must be Lead, Customer, or VIP only
- "Tags": Pipe-separated tags (tag1|tag2|tag3)
- "Notes": Any additional client notes

Mapping Rules:
1. Match headers semantically - "Cellular", "Ph", "Mobile", "Cell" all map to "Phone"
2. "Given Name", "FName" map to "First Name"
3. "Surname", "LName", "Family Name" map to "Last Name"
4. For Address: If you see a single combined address field, map it to "Address". If you see MULTIPLE address component columns (Street, City, State, Zip, etc.), do NOT map any of them to "Address" - instead include them in the addressComponents array.
5. "Source", "Lead Origin", "Referral", "How Found" map to "Tags" (will be used as a tag)
6. "DOB", "Birth Date", "Date of Birth" map to "Birthday"
7. "Type", "Client Type", "Category" may map to "Status" if values are Lead/Customer/VIP
8. "Comments", "Note", "Additional Info" map to "Notes"
9. Each target can only be used ONCE
10. If no good match exists, set target to null

Address Component Detection:
- Identify columns that are parts of an address: Street/Address Line 1, Address Line 2/Apt/Suite, City, State/Province, Zip/Postal Code, Country
- ALSO detect standalone "Address" columns - these often contain street addresses that users want to combine with City, State, Zip
- These should be detected even if they won't be directly mapped to "Address"
- Valid roles: street1, street2, address, city, state, zip, country
  - street1: Address Line 1, Street 1, Street Address
  - address: Standalone "Address" column (not Address Line 1/2)
  - street2: Address Line 2, Apt, Suite, Unit
  - city, state, zip, country: self-explanatory
- Order them logically: street1=0, address=1, street2=2, city=3, state=4, zip=5, country=6

Name Split Detection:
- CRITICAL: If you see a combined name column (Full Name, Name, Client Name, Customer Name, Contact Name) WITHOUT separate First Name AND Last Name columns, flag it for splitting
- Common combined name columns: "Full Name", "Name", "Client Name", "Customer Name", "Contact Name", "Fullname", "Client", "Contact"
- Do NOT flag if there are already separate "First Name" and "Last Name" columns
- If flagged, DO NOT map the combined name column to First Name or Last Name

Return a JSON object with:
1. "mappings" array - each mapping has:
   - "source": exact source header name
   - "target": exact target header name (or null if no match)
   - "confidence": number 0-1 indicating match confidence
2. "addressComponents" array (only if 2+ address parts detected) - each has:
   - "source": exact source header name
   - "role": one of street1, address, street2, city, state, zip, country
   - "order": number for ordering (0-6)
3. "nameSplitColumn" object (only if combined name column detected without First/Last Name columns) - has:
   - "source": exact source header name of the combined name column`;

    const userPrompt = `Map these source headers to the vcita target CRM headers:

Source Headers: ${JSON.stringify(sourceHeaders)}

Return JSON in this exact format:
{
  "mappings": [
    {"source": "source_header", "target": "Target Header or null", "confidence": 0.95},
    ...
  ],
  "addressComponents": [
    {"source": "Street", "role": "street1", "order": 0},
    {"source": "City", "role": "city", "order": 2},
    ...
  ],
  "nameSplitColumn": {
    "source": "Full Name"
  }
}

Notes:
- Only include addressComponents if you detect 2 or more address-related columns.
- Only include nameSplitColumn if you detect a combined name column (Full Name, Name, Client Name, etc.) WITHOUT separate First Name and Last Name columns. If flagged, do NOT map it to First Name or Last Name.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    const content = data.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim() === "") {
      console.error("AI returned empty content");
      throw new Error("AI returned empty response");
    }
    
    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to extract JSON from AI response");
      throw new Error("Invalid AI response format - no JSON found");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse JSON from AI response");
      throw new Error("Invalid JSON in AI response");
    }
    
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const corsHeaders = getCorsHeaders(req);
    console.error("map-headers error:", error instanceof Error ? error.message : "Unknown error");
    
    return new Response(
      JSON.stringify({ error: "Failed to process header mapping. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
