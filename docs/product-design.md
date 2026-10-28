# Product design

## Primary journey

Roomwise opens on the selected person's upcoming reservations. The greeting establishes whose schedule is being shown. Administrator starts with the workspace schedule. The first question is “what is next?”, followed by “where can I meet?” and “can I change my booking?”. Historical records are available when requested and never mixed into the initial view.

## Product references

The interaction model draws on publicly documented workflows rather than copying a product's visual identity:

- [Robin: getting started](https://support.robinpowered.com/hc/en-us/articles/204474494-Getting-started-New-users): personal upcoming meetings on home, broader schedule on request, organizer-specific editing.
- [Robin: web room booking](https://support.robinpowered.com/hc/en-us/articles/12702448454925-Book-a-room-in-the-web-dashboard): date/time search, secondary filters, contextual event composition.
- [Envoy: employee room booking](https://envoy.help/en/articles/6812624-booking-checking-into-and-releasing-rooms-for-employees): immediate booking confirmation and meeting actions relevant to the current state.
- [Google Calendar: finding a time](https://support.google.com/calendar/answer/6294878): checking the proposed meeting time against room and organizer schedules.

## Decisions

| Need                              | Interface                                                                       | Server responsibility                                                      |
| --------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| See my next meeting               | Default My bookings / Upcoming                                                  | Filter Booked lifecycle state and organizer; order by start time           |
| Find an old booking               | Explicit History view                                                           | Completed/cancelled records, newest first                                  |
| Avoid endless scrolling           | Six reservations per page; compact room grid                                    | Filter, count and paginate one consistent snapshot                         |
| Know a booking saved              | Focused confirmation card above the schedule                                    | Return the committed reservation, including recovery after a lost response |
| Find a suitable space             | Search time first, optional capacity/floor/equipment filters                    | Calculate room and organizer conflicts for that interval                   |
| Keep my context                   | Member organizer filled automatically; searched room/time carried into the form | Revalidate ownership and all booking rules on save                         |
| Show more detail only when useful | Collapsed advanced filters and room identifiers                                 | Preserve required identifiers in the contract                              |

A short confirmation appears above the chronological schedule. The newly saved booking remains in the list, and the server opens its actual page, even when its date is weeks away. Changing scope, period, profile or manually refreshing clears the highlight. Successful cancellation or early completion removes the booking from Upcoming; History retains it.

## Frontend behavior

- Profile changes reset personal scope, forms and confirmation state.
- Query changes reset pagination. Responses for old requests are cancelled and never rendered under new filters.
- Page counts come from the same server-filtered result as the visible rows.
- Confirmation uses the server-returned DTO, not optimistic form contents.
- Mobile header, controls and card layouts keep useful content near the top. Horizontal overflow is tested at 320, 390, 768 and 1024 px.
- Keyboard focus reaches confirmation after saving. Native modal focus, Escape, touch targets and reduced-motion preferences remain supported.
- The fixed decorative background remains; the large photographic hero is removed from operational screens.

## Boundaries

Availability is a snapshot, not a temporary hold. Saving repeats validation under the write gate. Selectable sample profiles continue to model ownership without account authentication. Local storage remains EF Core InMemory as required by the assignment. Hosting uses one server instance, preserving the required InMemory storage model. Member reads return only that member's details; administrator views remain available through the synthetic profile model.

The extra-time dialog shows the exact available whole-minute gap and anonymous blocking interval. It disables submission when no gap remains and rechecks after a conflicting save. The backend repeats validation inside the booking gate.
