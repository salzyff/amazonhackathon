import {uid,today,type Household} from "../lib/household.ts";
const now=()=>new Date().toISOString();
export function seedHousehold(date = today()): Household {
  return { date, name: "Our household", selfId: "sam",
    members: [
      { id: "sam", userId: "sam", name: "Sam", role: "You", initials: "S", color: "peach", availableFrom: 480, availableUntil: 1320, pickupAllowed: true, canReceive: true, atHome: false },
      { id: "tola", userId: "tola", name: "Tola", role: "Family", initials: "T", color: "mint", availableFrom: 840, availableUntil: 1200, pickupAllowed: true, canReceive: true, atHome: false },
      { id: "maya", userId: "maya", name: "Maya", role: "Housemate", initials: "M", color: "lilac", availableFrom: 990, availableUntil: 1320, pickupAllowed: false, canReceive: true, atHome: true },
      { id: "dele", userId: "dele", name: "Dele", role: "Trusted neighbour", initials: "D", color: "blue", availableFrom: 840, availableUntil: 1020, pickupAllowed: true, canReceive: false, atHome: false },
    ],
    events: [
      { id: "meeting", date, title: "Team catch-up", kind: "meeting", start: 840, end: 900, ownerId: "sam", location: "Office", flexible: false, status: "scheduled" },
      { id: "school", date, title: "Pick up Noah", kind: "pickup", start: 930, end: 975, ownerId: "sam", location: "Oakfield Primary", flexible: false, status: "scheduled" },
      { id: "groceries", date, title: "Groceries arrive", kind: "delivery", start: 1020, end: 1050, ownerId: "sam", location: "Home · delivery window", flexible: false, status: "scheduled" },
      { id: "dinner", date, title: "Pick up dinner ingredients", kind: "errand", start: 1110, end: 1140, ownerId: "sam", location: "Neighbourhood market", flexible: true, status: "scheduled" },
    ],
    memories: [
      { id: "m1", text: "Only Tola, Dele, and Sam are approved for Noah's school pickup.", createdAt: now() },
      { id: "m2", text: "Maya is usually home after 4:30 pm and can receive deliveries.", createdAt: now() },
      { id: "m3", text: "School pickup is fixed. Dinner errands can wait.", createdAt: now() },
    ],
    plans: [], messages: [{ id: uid(), role: "assistant", text: "Hi Sam. Everyone’s plans are in one place. If your day changes, tell me what happened and we’ll work out the next step together.", createdAt: now() }], activity: [],
  };
}
