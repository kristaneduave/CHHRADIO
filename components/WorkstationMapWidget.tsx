import React, { useEffect, useRef, useState } from 'react';
import { AssignOccupancyPayload, CurrentWorkstationStatus, Floor, NewsfeedOnlineUser } from '../types';
import { workstationMapService } from '../services/workstationMapService';
import { supabase } from '../services/supabase';
import { fetchOnlineProfiles, subscribeToOnlineUsers } from '../services/newsfeedPresenceService';
import { workspacePresenceService } from '../services/virtualWorkspacePresence';
import CompactWorkstationWidget from './CompactWorkstationWidget';
import WorkstationViewerModal from './WorkstationViewerModal';
import WorkstationActionModal from './WorkstationActionModal';
import AssignOccupancyModal from './AssignOccupancyModal';
import OccupantProfileModal from './OccupantProfileModal';
import OnlineUsersModal from './OnlineUsersModal';

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
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [currentStatusMessage, setCurrentStatusMessage] = useState<string | null>(null);
  const fallbackViewerIdRef = useRef(`guest-${Math.random().toString(36).slice(2, 10)}`);
  const viewerUserId = currentUserId || fallbackViewerIdRef.current;

  useEffect(() => {
    if (!isViewerModalOpen) return;
    setCurrentStatusMessage(workspacePresenceService.getCurrentStatusMessage());
  }, [isViewerModalOpen]);

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
        currentUserId={viewerUserId}
        loading={loading}
        onPinClick={handlePinClick}
        onReleaseWorkstation={handleRelease}
        onCheckCurrentUserOccupancy={(workstationId) =>
          workstationMapService.isCurrentUserOccupyingWorkstation(workstationId, { maxAgeMs: 2500 })
        }
        onSetAvatarStatus={handleSetAvatarStatus}
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
