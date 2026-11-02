-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function add_group(root, row)
    root[row.world] = root[row.world] or {}
    local worlds = root[row.world]
    worlds[row.subject] = worlds[row.subject] or {}
    local subjects = worlds[row.subject]
    subjects[row.predicate] = subjects[row.predicate] or {}
    local group = subjects[row.predicate]
    group[#group + 1] = row
end

function M.detect(rows, max_conflicts)
    max_conflicts = max_conflicts or 100000
    assert(math.type(max_conflicts) == "integer" and max_conflicts >= 0,
        "invalid output limit")

    local groups, conflicts = {}, {}
    for _, row in ipairs(rows) do
        add_group(groups, row)
    end

    for _, worlds in pairs(groups) do
        for _, subjects in pairs(worlds) do
            for _, group in pairs(subjects) do
                table.sort(group, function(a, b)
                    if a.start ~= b.start then return a.start < b.start end
                    if a["end"] ~= b["end"] then
                        return a["end"] < b["end"]
                    end
                    return a.id < b.id
                end)

                local active = {}
                for _, current in ipairs(group) do
                    local kept = {}

                    for _, previous in ipairs(active) do
                        -- Named policy: meets is not duration overlap.
                        if previous["end"] > current.start then
                            kept[#kept + 1] = previous

                            if previous.value ~= current.value then
                                if #conflicts >= max_conflicts then
                                    return {
                                        status = "conflict_limit_exceeded",
                                        emittedConflictCount = #conflicts
                                    }
                                end

                                local a, b = previous.id, current.id
                                if b < a then a, b = b, a end
                                conflicts[#conflicts + 1] = { a, b }
                            end
                        end
                    end

                    kept[#kept + 1] = current
                    active = kept
                end
            end
        end
    end

    return { status = "complete", conflicts = conflicts }
end

return M
