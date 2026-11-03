-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: canonical rng module, or explicit injection through bind().
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local PARK_MILLER = "park-miller-16807-v1"

local function bind(core)
    assert(type(core) == "table"
        and type(core.new_park_miller) == "function"
        and type(core.restore) == "function",
        "park_miller_rng: compatible core RNG module required")

    local M = {
        ALGORITHM = PARK_MILLER,
        VERSION = "grimlore.park-miller-adapter.v1"
    }

    function M.new(seed)
        return core.new_park_miller(seed)
    end

    function M.restore(text)
        if type(text) ~= "string"
            or text:sub(1, #PARK_MILLER + 1) ~= PARK_MILLER .. ":" then
            error("park_miller_rng: Park-Miller state required", 2)
        end

        local restored = core.restore(text)

        if restored.algorithm() ~= PARK_MILLER then
            error("park_miller_rng: wrong restored algorithm", 2)
        end

        return restored
    end

    function M.self_test()
        return core.self_test()
    end

    M.bind = bind
    return M
end

return bind(require("lua.rng"))
