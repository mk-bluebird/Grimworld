-- RUNTIME: Lua 5.1 / Lua 5.4 common subset; standard numeric builds.
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local P = require("lua.place_clay_houses")
local text = P.serialize(P.generate({
    seed=1,count=8,spacing=24,jitter=2,width=12,origin_x=0,origin_y=0
}))
io.write(text)
