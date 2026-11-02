-- RUNTIME: Lua 5.1 and Lua 5.4 common subset; no engine APIs.
-- NUMERIC PROFILE: double-precision-or-better arithmetic required.
-- DEPENDENCIES: lua/rng.lua; run with repository root on package.path.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/workstream metadata only; not identity, consent,
-- authorization, or execution evidence.

local RNG = require("lua.rng")
local M = {}

local ANCHOR =
    "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7"

local function integer(value, low, high, label)
    assert(type(value) == "number"
        and value == math.floor(value)
        and value >= low
        and value <= high,
        label .. " outside supported integer range")
    return value
end

function M.generate(config)
    assert(type(config) == "table", "configuration required")

    local count = integer(config.count, 1, 1000, "count")
    local spacing = integer(config.spacing, 1, 100000, "spacing")
    local jitter = integer(config.jitter, 0, 1000, "jitter")
    local width = integer(config.width, 1, 10000, "width")
    local origin_x = integer(config.origin_x, -1000000, 1000000, "origin_x")
    local origin_y = integer(config.origin_y, -1000000, 1000000, "origin_y")

    -- Slots remain non-overlapping despite horizontal jitter.
    assert(spacing >= width + 2 * jitter,
        "spacing insufficient for house width and jitter")

    local random = RNG.new(config.seed)

    -- Fixed draw order: missing plug first, then x/y jitter per house.
    local missing_plug = random.integer(1, count)
    local houses = {}

    for index = 1, count do
        houses[index] = {
            id = string.format("clay_house_%04d", index),
            x = origin_x + (index - 1) * spacing
                + random.integer(-jitter, jitter),
            y = origin_y + random.integer(-jitter, jitter),
            width = width,
            material = "clay",
            wax_plug = index ~= missing_plug,
            custom_id = "clay_house_river_custom",
            authenticity = "fictional"
        }
    end

    return {
        profile = "grimlore.clay-house-placement.v1",
        algorithm = RNG.ALGORITHM,
        seed = config.seed,
        final_rng_state = random.serialize(),
        attribution = ANCHOR,
        authenticity = {
            status = "fictional",
            label = "Fictional custom created for Grimlore.",
            source_basis = "user_supplied_description",
            custom_id = "clay_house_river_custom"
        },
        houses = houses
    }
end

function M.serialize(result)
    -- This serializer accepts this module's generated result.
    -- Fixed field order, integer formatting, ASCII, and LF newlines.
    assert(result.profile == "grimlore.clay-house-placement.v1",
        "unsupported result profile")
    assert(result.authenticity.status == "fictional",
        "fiction label required")

    local lines = {
        "profile=" .. result.profile,
        "algorithm=" .. result.algorithm,
        "seed=" .. string.format("%d", result.seed),
        "final_rng_state=" .. result.final_rng_state,
        "attribution=" .. result.attribution,
        "authenticity=fictional",
        "label=Fictional custom created for Grimlore.",
        "id\tx\ty\twidth\twax_plug\tauthenticity"
    }

    for _, house in ipairs(result.houses) do
        assert(house.authenticity == "fictional",
            "house fiction label required")
        lines[#lines + 1] = string.format(
            "%s\t%d\t%d\t%d\t%s\tfictional",
            house.id,
            house.x,
            house.y,
            house.width,
            house.wax_plug and "present" or "absent"
        )
    end

    return table.concat(lines, "\n") .. "\n"
end

return M
