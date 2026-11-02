-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none. RNG belongs to fixtures, not production loading.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local kinds = setmetatable({}, { __mode = "k" })
local admitted = setmetatable({}, { __mode = "k" })
M.NULL = {}

local function tagged(kind, value)
    assert(type(value) == "table" and getmetatable(value) == nil,
        "plain table required")
    local result = {}
    for k, v in pairs(value) do result[k] = v end
    kinds[result] = kind
    return result
end

function M.object(value) return tagged("object", value) end
function M.array(value) return tagged("array", value) end

local function clone(value)
    if value == M.NULL then return M.NULL end
    if type(value) ~= "table" then return value end
    local result = {}
    kinds[result] = kinds[value]
    for k, v in pairs(value) do result[k] = clone(v) end
    return result
end

local function O(fields, optional, open)
    return { kind = "object", fields = fields or {},
        optional = optional or {}, open = open or false }
end

local function A(item) return { kind = "array", item = item } end
local function E(values)
    local allowed = {}
    for _, value in ipairs(values) do allowed[value] = true end
    return { kind = "enum", allowed = allowed }
end

local S = { kind = "string" }
local B = { kind = "boolean" }
local ANY = { kind = "any" }
local OPEN = O({}, {}, true)
local IDS = A(S)

local BASIS = E({
    "explicit_description",
    "derived_interpretation",
    "implementation_choice"
})

local ENTITY = O({
    id = S, kind = S,
    realm = E({ "living", "parallel", "river", "boundary", "unspecified" }),
    placement = S, attributes = OPEN, basis = BASIS
})

local RELATIONSHIP = O({
    id = S, subject = S, predicate = S, object = S,
    qualifiers = OPEN, basis = BASIS
})

local ROOT = O({
    id = S,
    provenance = O({
        basis = E({ "user_supplied_description" }),
        invented_lore = B,
        unspecified = IDS
    }, { unspecified = true }),
    composition = O({
        principal_subject = S,
        focal_target = S,
        eye_path = IDS,
        depth_layers = O({
            foreground = IDS,
            middle_ground = IDS,
            background = IDS
        }),
        negative_space = S
    }),
    entities = A(ENTITY),
    relationships = A(RELATIONSHIP),
    appearance = O({
        medium = S,
        palette = OPEN,
        lights = A(OPEN),
        surface_treatments = A(OPEN)
    }),
    constraints = A(O({
        id = S, statement = S, basis = BASIS
    }))
})

local function escape(value)
    return (value:gsub("~", "~0"):gsub("/", "~1"))
end

function M.load(document)
    local diagnostics = {}
    local active = {}
    local visits = 0
    local exhausted = false

    local function report(code, path, message)
        diagnostics[#diagnostics + 1] = {
            code = code, path = path, message = message
        }
    end

    local visit
    visit = function(value, schema, path, depth)
        if exhausted then return end
        visits = visits + 1

        if visits > 20000 or depth > 128 then
            exhausted = true
            report("RESOURCE_LIMIT", path, "loader traversal limit exceeded")
            return
        end

        local t = type(value)
        local kind = schema.kind

        if kind == "enum" then
            if t ~= "string" or not schema.allowed[value] then
                report("ENUM", path, "value outside declared enum")
            end
            return
        end

        if kind == "string" or kind == "boolean" then
            if t ~= kind then report("TYPE", path, "expected " .. kind) end
            return
        end

        if kind == "any" then
            if value == M.NULL then return end
            if t == "string" or t == "boolean" then return end
            if t == "number" then
                if value ~= value or value == math.huge or value == -math.huge then
                    report("TYPE", path, "non-finite number")
                end
                return
            end
            if t ~= "table" then
                report("TYPE", path, "unsupported JSON value")
                return
            end
            kind = kinds[value]
            if kind ~= "object" and kind ~= "array" then
                report("TYPE", path, "tagged JSON table required")
                return
            end
            schema = kind == "array" and A(ANY) or OPEN
        end

        if value == M.NULL or t ~= "table"
            or getmetatable(value) ~= nil or kinds[value] ~= kind then
            report("TYPE", path, "expected tagged " .. tostring(kind))
            return
        end

        if active[value] then
            report("CYCLE", path, "cyclic table is not JSON")
            return
        end
        active[value] = true

        if kind == "array" then
            local count, largest = 0, 0
            local valid = true
            for k in pairs(value) do
                if type(k) ~= "number" or k < 1 or k ~= math.floor(k) then
                    valid = false
                else
                    count = count + 1
                    if k > largest then largest = k end
                end
            end

            if not valid or count ~= largest then
                report("ARRAY_SHAPE", path, "dense integer-indexed array required")
            else
                for i = 1, count do
                    visit(value[i], schema.item, path .. "/" .. (i - 1), depth + 1)
                end
            end
        else
            for name, child in pairs(schema.fields) do
                if rawget(value, name) == nil then
                    if not schema.optional[name] then
                        report("REQUIRED", path .. "/" .. escape(name),
                            "required field missing")
                    end
                else
                    visit(value[name], child, path .. "/" .. escape(name), depth + 1)
                end
            end

            for name, child in pairs(value) do
                if type(name) ~= "string" then
                    report("OBJECT_KEY", path, "string object key required")
                elseif not schema.fields[name] then
                    if schema.open then
                        visit(child, ANY, path .. "/" .. escape(name), depth + 1)
                    else
                        report("ADDITIONAL_PROPERTY", path .. "/" .. escape(name),
                            "field not allowed")
                    end
                end
            end
        end

        active[value] = nil
    end

    visit(document, ROOT, "", 0)

    table.sort(diagnostics, function(a, b)
        if a.path ~= b.path then return a.path < b.path end
        return a.code < b.code
    end)

    if #diagnostics > 0 then
        return {
            status = exhausted and "resource_limit" or "rejected",
            diagnostics = diagnostics
        }
    end

    local token = {}
    admitted[token] = clone(document)
    return { status = "accepted", token = token, diagnostics = {} }
end

function M.read(token)
    local document = admitted[token]
    assert(document, "unknown admitted-scene token")
    return clone(document)
end

return M
