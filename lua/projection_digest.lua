-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: injected entity registry.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX_INTEGER = 9007199254740991

local function byte_less(a, b)
    local common = math.min(#a, #b)
    for i = 1, common do
        local x, y = a:byte(i), b:byte(i)
        if x ~= y then return x < y end
    end
    return #a < #b
end

local function pack(text)
    return string.format("%.0f", #text) .. ":" .. text
end

local function decode_token(text)
    local i = 1
    while i <= #text do
        if text:sub(i, i) == "~" then
            local next_char = text:sub(i + 1, i + 1)
            assert(next_char == "0" or next_char == "1",
                "invalid JSON Pointer escape")
            i = i + 2
        else
            i = i + 1
        end
    end
    return (text:gsub("~1", "/"):gsub("~0", "~"))
end

local function field(entity, pointer)
    if pointer == "/kind" then return rawget(entity, "kind") end
    if pointer == "/realm" then return rawget(entity, "realm") end

    local encoded = pointer:match("^/attributes/([^/]+)$")
    assert(encoded, "only declared scalar projection paths are supported")
    assert(type(entity.attributes) == "table", "attributes required")

    return rawget(entity.attributes, decode_token(encoded))
end

local function scalar_bytes(value)
    local kind = type(value)

    if kind == "string" then
        assert(#value <= 16384, "projection string too long")
        return "s" .. pack(value)
    end

    if kind == "boolean" then
        return value and "b1" or "b0"
    end

    if kind == "number" then
        assert(value == math.floor(value)
            and value >= -MAX_INTEGER and value <= MAX_INTEGER,
            "projection numbers must be safe integers")
        if value == 0 then value = 0 end
        return "i" .. pack(string.format("%.0f", value))
    end

    error("missing or nonscalar projection field")
end

local function adler32_hex(bytes)
    local a, b = 1, 0
    for i = 1, #bytes do
        a = (a + bytes:byte(i)) % 65521
        b = (b + a) % 65521
    end

    -- Floating multiplication avoids signed-32-bit integer overflow
    -- on a configured 32-bit-integer Lua build.
    local value = b * 65536.0 + a
    local digits = "0123456789abcdef"
    local result = {}

    for i = 8, 1, -1 do
        local digit = value % 16
        result[i] = digits:sub(digit + 1, digit + 1)
        value = math.floor(value / 16)
    end

    return table.concat(result)
end

function M.projection_comparison_digest(registry, handle, profile)
    assert(type(profile) == "table", "projection profile required")
    assert(type(profile.id) == "string" and profile.id ~= "",
        "profile ID required")
    assert(type(profile.revision) == "string" and profile.revision ~= "",
        "profile revision required")
    assert(type(profile.fields) == "table"
        and #profile.fields >= 1 and #profile.fields <= 64,
        "1..64 fields required")

    local entity = registry.read(handle)
    local fields, seen = {}, {}

    for index, pointer in ipairs(profile.fields) do
        assert(type(pointer) == "string" and #pointer <= 512,
            "invalid projection path")
        assert(pointer ~= "/id", "identity field excluded from comparison")
        assert(not seen[pointer], "duplicate projection field")
        seen[pointer] = true
        fields[index] = pointer
    end

    -- Do not use locale-dependent string ordering for canonical bytes.
    table.sort(fields, byte_less)

    local parts = {
        "grimlore.scalar-projection.v1",
        pack(profile.id),
        pack(profile.revision)
    }

    for _, pointer in ipairs(fields) do
        parts[#parts + 1] = pack(pointer)
        parts[#parts + 1] = scalar_bytes(field(entity, pointer))
    end

    local bytes = table.concat(parts)
    assert(#bytes <= 131072, "projection byte limit exceeded")

    return {
        usage = "comparison_not_identity",
        algorithm = "adler32_noncryptographic",
        profile_id = profile.id,
        profile_revision = profile.revision,
        source_entity_id = entity.id,
        digest = adler32_hex(bytes),
        canonical_bytes = bytes
    }
end

function M.same_projection_bytes(a, b)
    assert(a.usage == "comparison_not_identity"
        and b.usage == "comparison_not_identity",
        "comparison records required")
    return a.canonical_bytes == b.canonical_bytes
end

return M
