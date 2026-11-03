-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: injected entity registry and explicit JSON-null sentinel.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

function M.new(config)
    assert(type(config) == "table" and getmetatable(config) == nil,
        "plain configuration required")

    local allowed = {
        registry = true, bell = true, tower = true,
        null_value = true, supports = true
    }

    for key in pairs(config) do
        assert(allowed[key], "unknown bell configuration field")
    end

    assert(type(config.null_value) == "table",
        "explicit JSON-null sentinel required")
    assert(rawget(config, "supports") == config.null_value,
        "supports must explicitly contain the null sentinel")
    assert(config.bell ~= config.tower,
        "bell and tower identities must differ")

    local registry = config.registry
    local bell = registry.read(config.bell)
    local tower = registry.read(config.tower)

    assert(bell.realm == "parallel" and tower.realm == "parallel",
        "far-bell profile requires parallel-realm entities")

    local null_value = config.null_value
    local api = {}

    function api.placement()
        return {
            profile = "grimlore.far-bell.v1",
            bell_id = bell.id,
            reference_entity_id = tower.id,

            reference_kind = "visual_relation_not_attachment",
            horizontal_relation = "outside_tower",
            depicted_posture = "hanging",

            supports = null_value,
            support_visibility = "not_visible",
            physical_support = "unestablished",

            basis = "explicit_description",
            semantics = "depicted_not_proven"
        }
    end

    function api.attach_support(_)
        return {
            status = "rejected",
            code = "SUPPORT_REPAIR_FORBIDDEN",
            bell_id = bell.id
        }
    end

    return api
end

return M
