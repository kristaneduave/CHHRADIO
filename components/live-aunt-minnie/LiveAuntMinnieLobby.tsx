import React from 'react';
import { LiveAuntMinnieRoomState } from '../../types';

interface LiveAuntMinnieLobbyProps {
  roomState: LiveAuntMinnieRoomState;
}

const participantName = (participant: LiveAuntMinnieRoomState['participants'][number]) =>
  participant.profile?.nickname || participant.profile?.full_name || 'Resident';

const LiveAuntMinnieLobby: React.FC<LiveAuntMinnieLobbyProps> = ({ roomState }) => {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">Lobby</p>
          <h3 className="mt-2 text-2xl font-black text-white">{roomState.session.title}</h3>
          <p className="mt-2 text-sm text-slate-400">Share join code <span className="font-bold text-white">{roomState.session.join_code}</span> with the residents.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Participants</p>
          <p className="mt-1 text-2xl font-black text-white">{roomState.participantCount}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roomState.participants.map((participant) => (
          <div key={participant.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">{participantName(participant)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{participant.role}</p>
          </div>
        ))}
        {roomState.participants.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
            Waiting for residents to join.
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveAuntMinnieLobby;
