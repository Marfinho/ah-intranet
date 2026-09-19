import type { Room, RoomBooking } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section, Tag } from "@/components/ui";
import { RoomBookingForm } from "./room-booking-form";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { cancelRoomBookingAction } from "@/lib/actions";
import { formatRange } from "@/lib/utils";

interface RoomsResponse {
  rooms: Room[];
  bookings: RoomBooking[];
}

export default async function RoomsPage() {
  const session = await requireModule("rooms");
  const data = await apiGet<RoomsResponse>("/rooms");

  return (
    <AppShell title="Raumbuchung" subtitle="Besprechungs- und Schulungsräume aller Standorte">
      <Section title="Raum buchen" subtitle="Überschneidungen werden automatisch abgewiesen">
        {data.rooms.length === 0 ? (
          <EmptyState title="Keine Räume hinterlegt" detail="Die Administration hat noch keine Räume angelegt." />
        ) : (
          <RoomBookingForm rooms={data.rooms} />
        )}
      </Section>

      <Section title="Räume" subtitle="Kapazität und Ausstattung">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.rooms.map((room) => (
            <article key={room.id} className="rounded-2xl border border-slate-200 p-5">
              <p className="font-semibold text-slate-900">{room.name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {room.location} · bis {room.capacity} Personen
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {room.equipment.map((entry) => (
                  <Tag key={entry}>{entry}</Tag>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title={`${data.bookings.length} Buchungen`} subtitle="Die nächsten zwei Wochen">
        {data.bookings.length === 0 ? (
          <EmptyState title="Keine Buchungen" detail="Alle Räume sind im gewählten Zeitraum frei." />
        ) : (
          <ul className="space-y-3">
            {data.bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {booking.roomName} · {booking.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatRange(booking.startsAt, booking.endsAt)} · {booking.organizer}
                  </p>
                </div>

                {booking.organizerUsername === session.username || session.roles.includes("admin") ? (
                  <ActionButton
                    variant="ghost"
                    confirm="Buchung stornieren?"
                    action={cancelRoomBookingAction.bind(null, booking.id)}
                  >
                    Stornieren
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
