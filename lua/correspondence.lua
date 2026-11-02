-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: entity_registry.lua-compatible registry instance.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function scalar(value)
    local t = type(value)
    return t == "string" or t == "boolean"
        or (t == "number" and value == value
            and value ~= math.huge and value ~= -math.huge)
end

local function list(value)
    assert(type(value) == "table" and getmetatable(value) == nil,
        "plain list required")
    local count, largest = 0, 0
    for key in pairs(value) do
        assert(type(key) == "number" and key >= 1
            and key == math.floor(key), "invalid list index")
        count = count + 1
        if key > largest then largest = key end
    end
    assert(count == largest, "dense list required")
    return value
end

function M.corresponds(registry, source_handle, target_handle, rule)
    assert(type(rule) == "table", "correspondence rule required")

    local findings = {}
    local invalid, violated, uncertain = false, false, false

    local function emit(code, key, category)
        findings[#findings + 1] = { code = code, key = key }
        if category == "invalid" then invalid = true end
        if category == "violation" then violated = true end
        if category == "uncertain" then uncertain = true end
    end

    if rule.scope ~= "listed_attributes" then
        emit("UNSUPPORTED_SCOPE", nil, "invalid")
        return { status = "invalid_rule", findings = findings }
    end

    local ok_a, source = pcall(registry.read, source_handle)
    local ok_b, target = pcall(registry.read, target_handle)

    if not ok_a or not ok_b then
        return {
            status = "invalid_input",
            findings = {{ code = "FOREIGN_ENTITY_HANDLE" }}
        }
    end

    local a, b = source.attributes, target.attributes
    assert(type(a) == "table" and type(b) == "table",
        "attribute dictionaries required")

    local owners = {}
    local alterations = {}

    local function register(key, category)
        assert(type(key) == "string" and key ~= "", "attribute key required")
        if owners[key] then
            emit("RULE_CONFLICT", key, "invalid")
        else
            owners[key] = category
        end
    end

    for _, key in ipairs(list(rule.preserve)) do
        register(key, "preserve")
    end

    for _, alteration in ipairs(list(rule.alter)) do
        assert(type(alteration) == "table", "alteration record required")
        register(alteration.key, "alter")
        alterations[#alterations + 1] = alteration
    end

    for _, key in ipairs(list(rule.exceptions or {})) do
        register(key, "exception")
    end

    if invalid then
        return { status = "invalid_rule", findings = findings }
    end

    local all_keys = {}
    for key in pairs(a) do all_keys[key] = true end
    for key in pairs(b) do all_keys[key] = true end

    local ordered = {}
    for key in pairs(all_keys) do ordered[#ordered + 1] = key end
    table.sort(ordered)

    for _, key in ipairs(ordered) do
        if not owners[key] then
            emit("UNCLASSIFIED_ATTRIBUTE", key, "invalid")
        end
    end

    local function comparable(key)
        if rawget(a, key) == nil or rawget(b, key) == nil then
            emit("MISSING_ATTRIBUTE", key, "uncertain")
            return false
        end
        if not scalar(a[key]) or not scalar(b[key]) then
            emit("NONSCALAR_OR_UNKNOWN_ATTRIBUTE", key, "uncertain")
            return false
        end
        return true
    end

    for _, key in ipairs(rule.preserve) do
        if comparable(key) and a[key] ~= b[key] then
            emit("PRESERVE_MISMATCH", key, "violation")
        end
    end

    local mirror_count = 0

    for _, change in ipairs(alterations) do
        local key = change.key

        if not scalar(change.from) or not scalar(change.to)
            or change.from == change.to then
            emit("INVALID_ALTERATION", key, "invalid")
        elseif change.operation ~= "replace" and change.operation ~= "mirror" then
            emit("UNKNOWN_OPERATION", key, "invalid")
        else
            if comparable(key)
                and (a[key] ~= change.from or b[key] ~= change.to) then
                emit("ALTER_MISMATCH", key, "violation")
            end

            if change.operation == "mirror" then
                mirror_count = mirror_count + 1

                local allowed =
                    rule.mirror_axis == "character_sagittal"
                    and (
                        (change.from == "left" and change.to == "right")
                        or (change.from == "right" and change.to == "left")
                        or (change.from == "source_side"
                            and change.to == "opposite_source_side")
                        or (change.from == "opposite_source_side"
                            and change.to == "source_side")
                    )

                if not allowed then
                    emit("UNSUPPORTED_MIRROR_MAPPING", key, "invalid")
                end
            end
        end
    end

    if mirror_count == 0 and rule.mirror_axis ~= nil then
        emit("UNUSED_MIRROR_AXIS", nil, "invalid")
    end

    local status = "satisfied"
    if invalid then status = "invalid_rule"
    elseif violated then status = "violated"
    elseif uncertain then status = "indeterminate"
    end

    return { status = status, findings = findings }
end

return M
