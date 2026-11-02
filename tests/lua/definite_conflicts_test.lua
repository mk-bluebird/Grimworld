-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local detector = dofile("grimlore/story/definite_conflicts.lua")

local function row(id, value, first, last, world)
    return {
        id = id,
        value = value,
        start = first,
        ["end"] = last,
        world = world or "living",
        subject = "widow",
        predicate = "lantern_state"
    }
end

local overlap = detector.detect({
    row("a", "lit", 0, 3),
    row("b", "unlit", 1, 2)
})
assert(overlap.status == "complete")
assert(#overlap.conflicts == 1)
assert(overlap.conflicts[1][1] == "a")
assert(overlap.conflicts[1][2] == "b")

assert(#detector.detect({
    row("a", "lit", 0, 1),
    row("b", "unlit", 1, 2)
}).conflicts == 0)

assert(#detector.detect({
    row("a", "lit", 0, 3, "living"),
    row("b", "unlit", 0, 3, "parallel")
}).conflicts == 0)

assert(detector.detect({
    row("a", "lit", 0, 3),
    row("b", "unlit", 0, 3)
}, 0).status == "conflict_limit_exceeded")
