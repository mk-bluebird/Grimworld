-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected entity registry and correspondence checker.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local OPPOSITE = {
    left = "right",
    right = "left",
    source_side = "opposite_source_side",
    opposite_source_side = "source_side"
}

local FIELDS = {
    head_inclination = true,
    coat_motif = true,
    shoulder_repair = true,
    lantern_state = true,
    held_object = true
}

local function token(value)
    return type(value) == "string" and #value >= 1 and #value <= 128
end

local function copy(values)
    local result = {}
    for key, value in pairs(values) do result[key] = value end
    return result
end

local function rule(owner)
    return {
        scope = "listed_attributes",
        preserve = { "head_inclination", "coat_motif" },
        alter = {
            {
                key = "shoulder_repair",
                operation = "mirror",
                from = owner.shoulder_repair,
                to = OPPOSITE[owner.shoulder_repair]
            },
            {
                key = "lantern_state",
                operation = "replace",
                from = "lit",
                to = "unlit"
            },
            {
                key = "held_object",
                operation = "replace",
                from = "house_key",
                to = "open_lock"
            }
        },
        mirror_axis = "character_sagittal",
        exceptions = {}
    }
end

local function derive(owner)
    return {
        head_inclination = owner.head_inclination,
        coat_motif = owner.coat_motif,
        shoulder_repair = OPPOSITE[owner.shoulder_repair],
        lantern_state = "unlit",
        held_object = "open_lock"
    }
end

function M.new(config)
    assert(type(config) == "table", "configuration required")

    local registry = config.registry
    local checker = config.correspondence
    local owner_handle = config.owner
    local counterpart_handle = config.counterpart

    assert(owner_handle ~= counterpart_handle,
        "owner and counterpart identities must be distinct")

    local owner_entity = registry.read(owner_handle)
    local counterpart_entity = registry.read(counterpart_handle)
    local owner = copy(owner_entity.attributes)

    assert(token(owner.head_inclination), "head-inclination token required")
    assert(token(owner.coat_motif), "coat-motif token required")
    assert(OPPOSITE[owner.shoulder_repair], "supported shoulder side required")
    assert(owner.lantern_state == "lit", "source widow lantern must be lit")
    assert(owner.held_object == "house_key", "source widow must hold house key")

    local initial = checker.corresponds(
        registry, owner_handle, counterpart_handle, rule(owner)
    )
    assert(initial.status == "satisfied",
        "initial counterpart correspondence not established")

    local counterpart = derive(owner)
    local revision = 0
    local basis = "explicit_description"

    local function check_pair(a, b)
        -- Correspondence sees the private candidate attributes,
        -- not stale registry attributes.
        local overlay = {
            read = function(handle)
                if handle == owner_handle then
                    return { id = owner_entity.id, attributes = copy(a) }
                end
                if handle == counterpart_handle then
                    return { id = counterpart_entity.id, attributes = copy(b) }
                end
                error("foreign pair handle")
            end
        }

        return checker.corresponds(
            overlay, owner_handle, counterpart_handle, rule(a)
        )
    end

    local api = {}

    function api.snapshot()
        return {
            profile = "grimlore.counterpart-pair.v1",
            owner_id = owner_entity.id,
            counterpart_id = counterpart_entity.id,
            owner = copy(owner),
            counterpart = copy(counterpart),
            revision = revision,
            basis = basis,
            semantics = "paired_depiction_not_event_proof"
        }
    end

    function api.update(subject_handle, patch)
        if subject_handle ~= owner_handle then
            return { status = "rejected", code = "UPDATE_SCOPE_DENIED" }
        end

        if type(patch) ~= "table" or getmetatable(patch) ~= nil then
            return { status = "rejected", code = "INVALID_PATCH" }
        end

        local candidate = copy(owner)
        local changed = false

        for key, value in pairs(patch) do
            if not FIELDS[key] then
                return { status = "rejected", code = "UNKNOWN_FIELD" }
            end

            if not token(value) then
                return { status = "rejected", code = "INVALID_VALUE" }
            end

            if key == "lantern_state" and value ~= "lit" then
                return { status = "rejected", code = "LANTERN_ASYMMETRY_LOCKED" }
            end

            if key == "held_object" and value ~= "house_key" then
                return { status = "rejected", code = "OBJECT_ASYMMETRY_LOCKED" }
            end

            if key == "shoulder_repair" and not OPPOSITE[value] then
                return { status = "rejected", code = "INVALID_SHOULDER_SIDE" }
            end

            if candidate[key] ~= value then changed = true end
            candidate[key] = value
        end

        if not changed then
            return { status = "unchanged", snapshot = api.snapshot() }
        end

        local candidate_counterpart = derive(candidate)
        local result = check_pair(candidate, candidate_counterpart)

        if result.status ~= "satisfied" then
            return {
                status = "rejected",
                code = "CORRESPONDENCE_NOT_SATISFIED"
            }
        end

        -- Commit only after the complete candidate pair passes.
        owner = candidate
        counterpart = candidate_counterpart
        revision = revision + 1
        basis = "implementation_choice"

        return { status = "updated", snapshot = api.snapshot() }
    end

    return api
end

return M
