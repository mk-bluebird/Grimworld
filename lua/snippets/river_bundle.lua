-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: inject the explicitly selected RNG module.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function integer(value, low, high)
    assert(type(value) == "number"
        and value == math.floor(value)
        and value >= low and value <= high,
        "invalid placement integer")
    return math.floor(value)
end

local function byte_less(a, b)
    for i = 1, math.min(#a, #b) do
        if a:byte(i) ~= b:byte(i) then
            return a:byte(i) < b:byte(i)
        end
    end
    return #a < #b
end

function M.place_clay_houses(RNG, preset)
    assert(RNG.ALGORITHM == "park-miller-16807-v1",
        "this fixture requires the Park-Miller profile")

    local count = integer(preset.count, 1, 1000)
    local spacing = integer(preset.spacing, 1, 100000)
    local jitter = integer(preset.jitter, 0, 1000)
    local width = integer(preset.width, 1, 10000)
    local x = integer(preset.origin_x, -1000000, 1000000)
    local y = integer(preset.origin_y, -1000000, 1000000)

    assert(spacing >= width + 2 * jitter,
        "spacing insufficient for width and jitter")

    local random = RNG.new(preset.seed)
    local fallen = random.integer(1, count)
    local houses = {}

    for index = 1, count do
        houses[index] = {
            id = string.format("clay_house_%04d", index),
            x = x + (index - 1) * spacing
                + random.integer(-jitter, jitter),
            y = y + random.integer(-jitter, jitter),
            width = width,
            plug = index == fallen and "fallen_out" or "present",
            authenticity = "fictional",
            purpose = "intentionally_open"
        }
    end

    return {
        profile = "grimlore.river-bundle-placement.v1",
        algorithm = RNG.ALGORITHM,
        seed = preset.seed,
        final_rng_state = random.serialize(),
        coordinate_basis = "implementation_choice",
        houses = houses
    }
end

function M.check_custom_claim(custom, claim)
    if claim.subject ~= custom.id or claim.topic ~= "purpose" then
        return { status = "not_applicable" }
    end

    assert(custom.purpose.state == "intentionally_open",
        "protected ambiguity profile required")

    if claim.treatment == "authoritative_resolution" then
        return {
            status = "rejected",
            code = "MYSTERY_RESOLVED",
            claim_id = claim.id
        }
    end

    if claim.treatment == "leaves_open" then
        return { status = "accepted", establishes_purpose = false }
    end

    if claim.treatment == "attributed_speculation"
        and custom.narrative_policy.allow_attributed_speculation
        and type(claim.speaker_id) == "string"
        and claim.speaker_id ~= "" then
        return {
            status = "accepted",
            establishes_purpose = false,
            speaker_id = claim.speaker_id
        }
    end

    return { status = "blocked", code = "CLAIM_REVIEW_REQUIRED" }
end

-- Canonical serialization of a SET of changed paths.
-- This does not serialize arbitrary JSON or establish entity identity.
function M.changed_path_set_bytes(paths)
    local sorted, seen = {}, {}

    for _, pointer in ipairs(paths) do
        assert(type(pointer) == "string", "path must be a string")
        assert(not seen[pointer], "duplicate changed path")
        seen[pointer] = true
        sorted[#sorted + 1] = pointer
    end

    table.sort(sorted, byte_less)
    if #sorted == 0 then return "" end
    return table.concat(sorted, "\n") .. "\n"
end

return M
