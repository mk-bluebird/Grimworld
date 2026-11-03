-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: injected entity registry.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function dense_list(values)
    if type(values) ~= "table" or getmetatable(values) ~= nil then
        return false
    end

    local count, largest = 0, 0
    for key in pairs(values) do
        if type(key) ~= "number"
            or key < 1 or key ~= math.floor(key) then
            return false
        end
        count = count + 1
        if key > largest then largest = key end
    end

    return count == largest
end

function M.new(config)
    assert(type(config) == "table", "configuration required")

    local registry = config.registry
    local group_handle = config.group
    local group = registry.read(group_handle)

    assert(type(group.id) == "string", "registered group required")
    assert(dense_list(config.houses) and #config.houses >= 1,
        "dense house list required")
    assert(type(config.allow_attributed_speculation) == "boolean",
        "explicit speculation policy required")

    local houses = {}
    local seen_handles = {}
    local missing = 0

    for index, item in ipairs(config.houses) do
        assert(type(item) == "table", "house record required")
        assert(not seen_handles[item.handle], "duplicate house handle")
        assert(item.handle ~= group_handle, "group is not an individual house")

        local entity = registry.read(item.handle)
        assert(item.plug == "present" or item.plug == "fallen_out",
            "plug must be present or fallen_out")

        seen_handles[item.handle] = true

        if item.plug == "fallen_out" then
            missing = missing + 1
        end

        houses[index] = {
            id = entity.id,
            plug = item.plug,
            opening = item.plug == "fallen_out"
                and "black_opening_visible"
                or "sealed_with_wax"
        }
    end

    assert(missing == 1, "exactly one plug must have fallen out")

    local api = {}

    function api.snapshot()
        local copied_houses = {}
        for index, house in ipairs(houses) do
            copied_houses[index] = {
                id = house.id,
                plug = house.plug,
                opening = house.opening
            }
        end

        return {
            profile = "grimlore.clay-house-ritual.v1",
            id = group.id,
            kind = "ritual_practice",
            authenticity_vocab = "grimlore.authenticity.v1",
            authenticity = "fictional",
            doorway_size = "thumb_sized",
            houses = copied_houses,

            purpose = {
                state = "intentionally_open",
                policy = "resolution_forbidden",
                basis = "implementation_choice"
            },

            purpose_policy_reason =
                "Preserve the supplied custom's unexplained purpose.",

            source_basis = "explicit_description",
            semantics = "depicted_custom_without_established_explanation"
        }
    end

    -- There is deliberately no setter that accepts an explanation.
    function api.resolve_purpose(_)
        return {
            status = "rejected",
            code = "PROTECTED_PURPOSE",
            subject_id = group.id
        }
    end

    function api.check_claim(claim)
        if type(claim) ~= "table"
            or type(claim.id) ~= "string" or claim.id == ""
            or type(claim.text) ~= "string" or claim.text == "" then
            return { status = "blocked", code = "INVALID_CLAIM" }
        end

        if claim.subject ~= group_handle then
            return { status = "not_applicable", code = "DIFFERENT_SUBJECT" }
        end

        if claim.topic ~= "purpose" then
            return { status = "not_applicable", code = "DIFFERENT_TOPIC" }
        end

        if claim.treatment == "authoritative_resolution" then
            return {
                status = "rejected",
                code = "MYSTERY_RESOLVED",
                claim_id = claim.id,
                subject_id = group.id
            }
        end

        if claim.treatment == "leaves_open" then
            return { status = "accepted", code = "PURPOSE_REMAINS_OPEN" }
        end

        if claim.treatment == "attributed_speculation" then
            if not config.allow_attributed_speculation then
                return {
                    status = "rejected",
                    code = "SPECULATION_NOT_PERMITTED"
                }
            end

            local ok, speaker = pcall(registry.read, claim.speaker)
            if not ok or type(speaker.id) ~= "string" then
                return {
                    status = "blocked",
                    code = "SPECULATION_SPEAKER_UNESTABLISHED"
                }
            end

            return {
                status = "accepted",
                code = "ATTRIBUTED_SPECULATION_ONLY",
                speaker_id = speaker.id,
                establishes_purpose = false
            }
        end

        return {
            status = "blocked",
            code = "CLAIM_REVIEW_REQUIRED",
            claim_id = claim.id
        }
    end

    return api
end

return M
