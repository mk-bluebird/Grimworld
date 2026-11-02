-- RUNTIME: Lua 5.1 / Lua 5.4 common subset; standard numeric builds.
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local RNG = require("lua.rng")
local M = {}
local ANCHOR = "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7"
local LABEL = "Fictional custom created for Grimlore."
local PROFILE = "grimlore.clay-house-placement.v2"
local COLUMN = "id\tx\ty\twidth\twax_plug\tauthenticity\tpurpose"
local fields = { "seed", "count", "spacing", "jitter", "width", "origin_x", "origin_y" }
local function int(v, low, high)
    assert(type(v) == "number" and v == math.floor(v)
        and v >= low and v <= high, "invalid placement integer")
    return math.floor(v)
end
local function safe(text)
    assert(type(text) == "string" and not text:find("[%c]"), "unsafe text field")
    return text
end
function M.generate(input)
    assert(type(input) == "table", "configuration required")
    local c = {
        seed = int(input.seed, 1, 2147483646),
        count = int(input.count, 1, 1000),
        spacing = int(input.spacing, 1, 100000),
        jitter = int(input.jitter, 0, 1000),
        width = int(input.width, 1, 10000),
        origin_x = int(input.origin_x, -1000000, 1000000),
        origin_y = int(input.origin_y, -1000000, 1000000)
    }
    assert(c.spacing >= c.width + 2*c.jitter, "unsafe spacing")
    local rng = RNG.new(c.seed)
    -- v2 preserves v1 draw order: absent-plug draw, then x/y pairs.
    local missing = rng.integer(1, c.count)
    local houses = {}
    for i = 1, c.count do
        houses[i] = {
            id = string.format("clay_house_%04d", i),
            x = c.origin_x + (i-1)*c.spacing + rng.integer(-c.jitter, c.jitter),
            y = c.origin_y + rng.integer(-c.jitter, c.jitter),
            width = c.width, wax_plug = i ~= missing,
            authenticity = "fictional", purpose = "intentionally_open"
        }
    end
    return {
        profile = PROFILE, config = c, final_rng_state = rng.serialize(),
        authenticity_vocab = "grimlore.authenticity.v1",
        authenticity = "fictional", label = LABEL,
        source_kind = "user_supplied_description", basis = "explicit_description",
        narrative_function = "unexplained_custom", purpose = "intentionally_open",
        attribution = ANCHOR, houses = houses
    }
end
function M.serialize(result)
    assert(result.profile == PROFILE, "unsupported profile")
    assert(result.authenticity_vocab == "grimlore.authenticity.v1", "unsupported vocabulary")
    safe(result.label)
    assert(result.label == LABEL and result.authenticity == "fictional", "fiction label required")
    assert(result.purpose == "intentionally_open" and result.narrative_function == "unexplained_custom", "ambiguity label required")
    assert(result.source_kind == "user_supplied_description" and result.basis == "explicit_description", "source metadata changed")
    assert(result.attribution == ANCHOR, "attribution changed")
    local c = result.config
    local lines = { "profile=" .. PROFILE, "algorithm=" .. RNG.ALGORITHM }
    for _, field in ipairs(fields) do
        lines[#lines+1] = field .. "=" .. string.format("%d", c[field])
    end
    local metadata = {
        {"final_rng_state", result.final_rng_state},
        {"attribution", result.attribution},
        {"authenticity_vocab", result.authenticity_vocab},
        {"authenticity", result.authenticity}, {"label", result.label},
        {"source_kind", result.source_kind}, {"basis", result.basis},
        {"narrative_function", result.narrative_function}, {"purpose", result.purpose}
    }
    for _, entry in ipairs(metadata) do
        lines[#lines+1] = entry[1] .. "=" .. safe(entry[2])
    end
    lines[#lines+1] = COLUMN
    assert(#result.houses == c.count, "wrong house count")
    local missing = 0
    for i, h in ipairs(result.houses) do
        assert(h.id == string.format("clay_house_%04d", i), "invalid house ID")
        int(h.x, -200000000, 200000000)
        int(h.y, -2000000, 2000000)
        assert(h.width == c.width and type(h.wax_plug) == "boolean", "invalid house")
        assert(h.authenticity == "fictional" and h.purpose == "intentionally_open", "house labels missing")
        if not h.wax_plug then missing = missing + 1 end
        lines[#lines+1] = string.format("%s\t%d\t%d\t%d\t%s\tfictional\tintentionally_open",
            h.id, h.x, h.y, h.width, h.wax_plug and "present" or "absent")
    end
    assert(missing == 1, "exactly one plug must be absent")
    return table.concat(lines, "\n") .. "\n"
end
function M.parse(text)
    assert(type(text) == "string" and #text <= 262144, "input limit")
    assert(text:sub(-1) == "\n" and not text:find("\r", 1, true), "LF framing required")
    local headers, found = {}, false
    for line in text:gmatch("(.-)\n") do
        if line == COLUMN then found = true; break end
        local k, v = line:match("^([a-z_]+)=(.*)$")
        assert(k and not headers[k], "bad or duplicate header")
        headers[k] = v
    end
    assert(found and headers.profile == PROFILE, "unsupported artifact")
    assert(headers.authenticity_vocab == "grimlore.authenticity.v1", "unsupported vocabulary")
    local c = {}
    for _, field in ipairs(fields) do c[field] = tonumber(headers[field]) end
    local expected = M.generate(c)
    -- Strict deterministic-artifact reader, not a general TSV parser:
    -- regeneration checks every header, label, row, and canonical ordering.
    assert(M.serialize(expected) == text, "noncanonical or modified artifact")
    return expected
end
return M
