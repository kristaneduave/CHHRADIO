import React, { useEffect, useMemo, useState } from 'react';
import {
  AssignOccupancyPayload,
  CurrentWorkstationStatus,
  Floor,
  MergedWorkspacePlayer,
  NewsfeedOnlineUser,
  WorkspaceAreaPresenceRow,
  WorkspacePlayer,
} from '../types';
import { workstationMapService } from '../services/workstationMapService';
import { supabase } from '../services/supabase';
import { fetchOnlineProfiles, subscribeToOnlineUsers } from '../services/newsfeedPresenceService';
import { workspacePresenceService } from '../services/virtualWorkspacePresence';
import { workspaceAreaPresenceService, ENABLE_PERSISTENT_AREA_PRESENCE } from '../services/workspaceAreaPresenceService';
import CompactWorkstationWidget from './CompactWorkstationWidget';
import WorkstationViewerModal from './WorkstationViewerModal';
import WorkstationActionModal from './WorkstationActionModal';
import AssignOccupancyModal from './AssignOccupancyModal';
import OccupantProfileModal from './OccupantProfileModal';
import OnlineUsersModal from './OnlineUsersModal';
import { toastError, toastSuccess } from '../utils/toast';

const WorkstationMapWidget: React.FC = () => {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloor, setActiveFloor] = useState<Floor | null>(null);
  const [workstations, setWorkstations] = useState<CurrentWorkstationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedWorkstation, setSelectedWorkstation] = useState<CurrentWorkstationStatus | null>(null);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState<NewsfeedOnlineUser[]>([]);
  const [workspacePlayers, setWorkspacePlayers] = useState<WorkspacePlayer[]>([]);
  const [areaPresenceRows, setAreaPresenceRows] = useState<WorkspaceAreaPresenceRow[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [currentStatusMessage, setCurrentStatusMessage] = useState<string | null>(null);
  const [isLeavingArea, setIsLeavingArea] = useState(false);

  useEffect(() => {
    if (!isViewerModalOpen) return;
    setCurrentStatusMessage(workspacePresenceService.getCurrentStatusMessage());
  }, [isViewerModalOpen]);

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = workspacePresenceService.subscribe({
      currentUserId,
      onPlayersChange: setWorkspacePlayers,
      onError: console.error,
    });
    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !ENABLE_PERSISTENT_AREA_PRESENCE) return;
    let mounted = true;

    const refresh = async () => {
      try {
        const rows = await workspaceAreaPresenceService.fetchActiveAreaPresence();
        if (mounted) setAreaPresenceRows(rows);
      } catch (error) {
        if (mounted) console.error('Failed to load persistent area presence:', error);
      }
    };

    void refresh();
    const unsubscribe = workspaceAreaPresenceService.subscribeAreaPresenceChanges(() => {
      void refresh();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentUserId]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && mounted) setCurrentUserId(user.id);

        const fetchedFloors = await workstationMapService.getFloors();
        if (!mounted) return;
        setFloors(fetchedFloors);

        if (fetchedFloors.length > 0) {
          setActiveFloor(fetchedFloors[0]);
          await loadWorkstations(fetchedFloors[0].id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load workspace data.');
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    let hydrateToken = 0;
    setLoadingOnline(true);
    setOnlineError(null);

    const unsubscribe = subscribeToOnlineUsers({
      currentUserId,
      trackCurrentUser: true,
      includeCurrentUser: true,
      onUsersChange: (ids) => {
        if (!mounted) return;
        const deduped = Array.from(new Set(ids));
        if (!deduped.length) {
          setOnlineUsers([]);
          setLoadingOnline(false);
          return;
        }
        const currentToken = ++hydrateToken;
        fetchOnlineProfiles(deduped)
          .then((users) => {
            if (!mounted || currentToken !== hydrateToken) return;
            setOnlineUsers([...users].sort((a, b) => a.displayName.localeCompare(b.displayName)));
            setLoadingOnline(false);
            setOnlineError(null);
          })
          .catch((err) => {
            console.error(err);
            if (!mounted || currentToken !== hydrateToken) return;
            setLoadingOnline(false);
            setOnlineError('Online status unavailable');
          });
      },
      onError: (message) => {
        if (!mounted) return;
        setLoadingOnline(false);
        setOnlineError(message);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentUserId]);

  const loadWorkstations = async (floorId: string) => {
    try {
      setLoading(true);
      const data = await workstationMapService.getWorkstationsByFloor(floorId);
      const hydrated = await workstationMapService.hydrateWorkstationOccupants(data);
      setWorkstations(hydrated);
      if (selectedWorkstation) {
        const refreshedSelected = hydrated.find((item) => item.id === selectedWorkstation.id) || null;
        setSelectedWorkstation(refreshedSelected);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFloorChange = async (floor: Floor) => {
    if (floor.id === activeFloor?.id) return;
    setActiveFloor(floor);
    await loadWorkstations(floor.id);
  };

  const handlePinClick = (ws: CurrentWorkstationStatus) => {
    setSelectedWorkstation(ws);
    const occupiedByOther =
      ws.status === 'IN_USE' &&
      ((ws.occupant_id && ws.occupant_id !== currentUserId) || !ws.occupant_id);

    if (occupiedByOther) {
      setIsProfileModalOpen(true);
      setIsActionModalOpen(false);
      return;
    }
    setIsActionModalOpen(true);
    setIsProfileModalOpen(false);
  };

  const handleClaim = async (workstationId: string) => {
    await workstationMapService.claimWorkstation(workstationId);
    if (activeFloor) await loadWorkstations(activeFloor.id);
  };

  const handleAssign = async (payload: AssignOccupancyPayload) => {
    if (!selectedWorkstation) return;
    await workstationMapService.assignWorkstation(selectedWorkstation.id, payload);
    if (activeFloor) await loadWorkstations(activeFloor.id);
    setIsAssignModalOpen(false);
    setIsActionModalOpen(false);
  };

  const handleUpdateStatus = async (workstationId: string, message: string | null) => {
    await workstationMapService.updateStatusMessage(workstationId, message);
    if (activeFloor) await loadWorkstations(activeFloor.id);
  };

  const handleRelease = async (workstationId: string) => {
    await workstationMapService.releaseWorkstation(workstationId);
    if (activeFloor) await loadWorkstations(activeFloor.id);
    setIsProfileModalOpen(false);
    setIsActionModalOpen(false);
  };

  const handleSetAvatarStatus = async (message: string | null) => {
    await workspacePresenceService.setStatusMessage(message);
    if (ENABLE_PERSISTENT_AREA_PRESENCE) {
      await workspaceAreaPresenceService.setMyAreaPresenceStatus(message);
    }
    setCurrentStatusMessage(workspacePresenceService.getCurrentStatusMessage());

    const occupiedMine = workstations.find(
      (ws) => ws.status === 'IN_USE' && ws.occupant_id === currentUserId,
    );

    if (occupiedMine?.id) {
      workstationMapService
        .updateStatusMessage(occupiedMine.id, message)
        .catch((error) => console.warn('Status updated in workspace, session sync failed:', error));
    }
  };

  const handleSetAreaPresence = async (floorId: string, x: number, y: number) => {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) return;
    try {
      await workspaceAreaPresenceService.upsertMyAreaPresence({
        floorId,
        x,
        y,
        statusMessage: workspacePresenceService.getCurrentStatusMessage(),
      });
    } catch (error: any) {
      console.error('Failed to persist area presence:', error);
    }
  };

  const handleLeaveArea = async () => {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE || !currentUserId) return;
    setIsLeavingArea(true);
    try {
      await workspaceAreaPresenceService.clearMyAreaPresence();
      await workspacePresenceService.updateLocalPlayer({
        floorId: null,
        isWalking: false,
        statusMessage: null,
      });
      setAreaPresenceRows((prev) => prev.filter((row) => row.userId !== currentUserId));
      toastSuccess('Presence removed', 'You are no longer pinned to a map area.');
    } catch (error: any) {
      console.error('Failed to leave area:', error);
      toastError('Failed to leave area', error?.message || 'Please try again.');
    } finally {
      setIsLeavingArea(false);
    }
  };

  const mergedPlayers = useMemo<MergedWorkspacePlayer[]>(() => {
    const byId = new Map<string, MergedWorkspacePlayer>();
    areaPresenceRows.forEach((row) => {
      byId.set(row.userId, {
        id: row.userId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        role: row.role,
        floorId: row.floorId,
        x: row.x,
        y: row.y,
        isWalking: false,
        statusMessage: row.statusMessage,
        source: 'persistent',
        persisted: true,
      });
    });

    workspacePlayers.forEach((player) => {
      const existing = byId.get(player.id);
      byId.set(player.id, {
        ...player,
        displayName:
          player.displayName && player.displayName !== 'User'
            ? player.displayName
            : existing?.displayName || player.displayName || 'User',
        avatarUrl: player.avatarUrl || existing?.avatarUrl || null,
        role: player.role || existing?.role,
        source: 'realtime',
        persisted: Boolean(existing?.persisted),
      });
    });

    return [...byId.values()];
  }, [areaPresenceRows, workspacePlayers]);

  return (
    <>
      {/* The Compact Entry Widget rendered right on the dashboard grid */}
      <CompactWorkstationWidget
        workstations={workstations}
        onlineUsers={onlineUsers}
        onOpenViewer={() => setIsViewerModalOpen(true)}
        loading={loading}
        error={error}
      />

      {/* The Full Premium Viewer Modal */}
      <WorkstationViewerModal
        isOpen={isViewerModalOpen}
        onClose={() => setIsViewerModalOpen(false)}
        workstations={workstations}
        onlineUsers={onlineUsers}
        players={mergedPlayers}
        currentUserId={currentUserId}
        loading={loading}
        onPinClick={handlePinClick}
        onReleaseWorkstation={handleRelease}
        onCheckCurrentUserOccupancy={(workstationId) =>
          workstationMapService.isCurrentUserOccupyingWorkstation(workstationId, { maxAgeMs: 2500 })
        }
        onSetAvatarStatus={handleSetAvatarStatus}
        onSetAreaPresence={handleSetAreaPresence}
        onLeaveArea={handleLeaveArea}
        isLeavingArea={isLeavingArea}
        currentStatusMessage={currentStatusMessage}
        floors={floors}
        error={error}
      />

      <WorkstationActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        workstation={selectedWorkstation}
        currentUserId={currentUserId}
        onOpenAssign={() => {
          setIsActionModalOpen(false);
          setIsAssignModalOpen(true);
        }}
        onClaim={handleClaim}
        onUpdateStatus={handleUpdateStatus}
        onRelease={handleRelease}
      />

      <AssignOccupancyModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={handleAssign}
        onSearchUsers={workstationMapService.searchAssignableOccupants}
      />

      <OccupantProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        workstation={selectedWorkstation}
        onRelease={handleRelease}
      />

      <OnlineUsersModal
        isOpen={isOnlineModalOpen}
        onClose={() => setIsOnlineModalOpen(false)}
        users={onlineUsers}
        loading={loadingOnline}
        error={onlineError}
      />
    </>
  );
};

export default WorkstationMapWidget;
