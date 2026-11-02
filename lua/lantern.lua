-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: injected entity registry.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local REALMS = {
    living = true,
    parallel = true,
    river = true,
    boundary = true,
    unspecified = true
}

function M.new(config)
    assert(type(config) == "table", "configuration required")
    assert(type(config.id) == "string" and config.id ~= "",
        "light ID required")
    assert(type(config.emission_description) == "string"
        and config.emission_description ~= "",
        "emission description required")
    assert(type(config.scope_reason) == "string"
        and config.scope_reason ~= "",
        "authored scope reason required")
    assert(type(config.enabled) == "boolean",
        "explicit enabled state required")

    local registry = config.registry
    local source = registry.read(config.source)
    assert(REALMS[source.realm], "invalid source realm")

    local realms, targets = {}, {}

    for _, realm in ipairs(config.allowed_target_realms) do
        assert(REALMS[realm], "invalid target realm")
        assert(not realms[realm], "duplicate target realm")
        realms[realm] = true
    end

    for _, handle in ipairs(config.allowed_targets) do
        assert(not targets[handle], "duplicate target handle")
        local entity = registry.read(handle)
        assert(realms[entity.realm],
            "configured target realm is not permitted")
        targets[handle] = entity.id
    end

    local id = config.id
    local enabled = config.enabled
    local description = config.emission_description
    local reason = config.scope_reason

    local api = {}

    function api.inspect()
        return {
            id = id,
            source_id = source.id,
            source_realm = source.realm,
            enabled = enabled,
            emission_description = description,
            scope_reason = reason,
            scope_basis = "implementation_choice",
            effect_semantics = "declared_target_influence"
        }
    end

    function api.affects(target_handle)
        local ok, entity = pcall(registry.read, target_handle)

        if not ok then
            return { status = "excluded", code = "FOREIGN_TARGET_HANDLE" }
        end

        local result = {
            source_id = source.id,
            source_realm = source.realm,
            target_id = entity.id,
            target_realm = entity.realm,
            effect_semantics = "declared_target_influence"
        }

        if not enabled then
            result.status = "excluded"
            result.code = "LIGHT_DISABLED"
        elseif not realms[entity.realm] then
            result.status = "excluded"
            result.code = "TARGET_REALM_DENIED"
        elseif not targets[target_handle] then
            result.status = "excluded"
            result.code = "TARGET_NOT_ALLOWLISTED"
        else
            result.status = "eligible"
            result.code = "DECLARED_INFLUENCE_ALLOWED"
        end

        return result
    end

    return api
end

return M
