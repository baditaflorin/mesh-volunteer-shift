import { useEffect, useMemo, useState } from "react";
import { MeshNameInput, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Slot = { date: string; time: string; label: string; capacity: number };
type Claim = { name: string; peerId: string; slotId: string; ts: number };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const newId = () => Math.random().toString(36).slice(2, 10);
const claimKey = (peerId: string, slotId: string) => `${peerId}|${slotId}`;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="vol-screen">
        <h1>volunteer shifts</h1>
        <p className="vol-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCapacity, setNewCapacity] = useState("2");
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const slots = room.doc.getMap<Slot>("slots");
    const claims = room.doc.getMap<Claim>("claims");
    const onChange = () => rerender((n) => n + 1);
    slots.observe(onChange);
    claims.observe(onChange);
    return () => {
      slots.unobserve(onChange);
      claims.unobserve(onChange);
    };
  }, [room]);

  const slots = room.doc.getMap<Slot>("slots");
  const claims = room.doc.getMap<Claim>("claims");

  const slotList = useMemo(() => {
    const arr: Array<Slot & { id: string }> = [];
    slots.forEach((v, k) => arr.push({ ...v, id: k }));
    arr.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, slots.size]);

  const claimsBySlot = useMemo(() => {
    const m = new Map<string, Claim[]>();
    claims.forEach((c) => {
      const list = m.get(c.slotId) ?? [];
      list.push(c);
      m.set(c.slotId, list);
    });
    m.forEach((list) => list.sort((a, b) => a.ts - b.ts));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, claims.size]);

  const addSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime) return;
    const cap = Math.max(1, Number(newCapacity) || 1);
    slots.set(newId(), {
      date: newDate,
      time: newTime,
      label: newLabel.trim(),
      capacity: cap,
    });
    setNewLabel("");
  };

  const removeSlot = (slotId: string) => {
    room.doc.transact(() => {
      slots.delete(slotId);
      claims.forEach((c, k) => {
        if (c.slotId === slotId) claims.delete(k);
      });
    });
  };

  const toggleClaim = (slotId: string) => {
    if (!name.trim()) return;
    const key = claimKey(room.peerId, slotId);
    if (claims.has(key)) {
      claims.delete(key);
    } else {
      claims.set(key, { name: name.trim(), peerId: room.peerId, slotId, ts: Date.now() });
    }
  };

  return (
    <div className="vol-screen">
      <header className="vol-header">
        <h1>volunteer shifts</h1>
        <p className="vol-status">
          {slotList.length} {slotList.length === 1 ? "shift" : "shifts"} · {claims.size}{" "}
          {claims.size === 1 ? "signup" : "signups"} · {room.peerCount + 1} present
        </p>
      </header>

      <MeshNameInput
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
        className="vol-name"
      />

      <section className="vol-list">
        {slotList.length === 0 ? (
          <p className="vol-empty">no shifts yet — add one below</p>
        ) : (
          slotList.map((s) => {
            const slotClaims = claimsBySlot.get(s.id) ?? [];
            const filled = slotClaims.length;
            const over = filled > s.capacity;
            const mine = slotClaims.some((c) => c.peerId === room.peerId);
            return (
              <article
                key={s.id}
                className={`vol-slot ${over ? "is-over" : ""} ${mine ? "is-mine" : ""}`}
              >
                <div className="vol-slot-head">
                  <div className="vol-slot-meta">
                    <strong>{s.date}</strong> · {s.time}
                    {s.label && <span className="vol-slot-label"> — {s.label}</span>}
                  </div>
                  <div className="vol-slot-count">
                    {filled}/{s.capacity}
                    {over && <span className="vol-warn">⚠ over</span>}
                  </div>
                </div>

                {slotClaims.length > 0 && (
                  <ul className="vol-slot-claims">
                    {slotClaims.map((c, i) => (
                      <li
                        key={c.peerId}
                        className={`${i >= s.capacity ? "is-over-cap" : ""} ${c.peerId === room.peerId ? "is-me" : ""}`}
                      >
                        {c.name}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="vol-slot-actions">
                  <button
                    type="button"
                    className={`vol-claim-btn ${mine ? "is-mine" : ""}`}
                    onClick={() => toggleClaim(s.id)}
                    disabled={!name.trim()}
                  >
                    {mine ? "✗ unclaim" : "+ claim"}
                  </button>
                  <button
                    type="button"
                    className="vol-rm-btn"
                    onClick={() => removeSlot(s.id)}
                    title="remove shift"
                    aria-label={`remove shift ${s.date} ${s.time}`}
                  >
                    delete shift
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <form className="vol-add" onSubmit={addSlot}>
        <h2 className="vol-add-title">add a shift</h2>
        <div className="vol-add-row">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="date"
            required
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            aria-label="time"
            required
          />
        </div>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="label (optional, e.g. setup, cleanup)"
          maxLength={80}
        />
        <div className="vol-add-row">
          <input
            type="number"
            min="1"
            step="1"
            value={newCapacity}
            onChange={(e) => setNewCapacity(e.target.value)}
            aria-label="capacity"
            placeholder="capacity"
          />
          <button type="submit" disabled={!newDate || !newTime}>
            + add shift
          </button>
        </div>
      </form>
    </div>
  );
}
