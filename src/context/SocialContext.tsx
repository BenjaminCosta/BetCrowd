/**
 * SocialContext — backward-compatibility shim.
 *
 * The social domain has been split into three focused contexts:
 *   - FriendsContext    (friends, requests, friend actions)
 *   - NotificationsContext (notifications, unreadCount, notification actions)
 *   - InvitesContext    (tournament invites, invite actions)
 *
 * Each context has its own memoized value so consumers only re-render when
 * the slice of data they care about actually changes.
 *
 * Prefer importing from the specific context in new code.
 * useSocial() and SocialProvider are kept here so existing call-sites continue
 * to compile while being migrated incrementally.
 */

import React, { useMemo, ReactNode } from 'react';
import { FriendsProvider, useFriends } from './FriendsContext';
import { NotificationsProvider, useNotifications } from './NotificationsContext';
import { InvitesProvider, useInvites } from './InvitesContext';

export { FriendsProvider, useFriends } from './FriendsContext';
export type { FriendWithProfile, FriendRequestWithProfile } from './FriendsContext';

export { NotificationsProvider, useNotifications } from './NotificationsContext';

export { InvitesProvider, useInvites } from './InvitesContext';

/** Backward-compatible hook combining all three social contexts into one object. */
export const useSocial = () => {
  const friends = useFriends();
  const notifications = useNotifications();
  const invites = useInvites();
  return useMemo(() => ({ ...friends, ...notifications, ...invites }), [friends, notifications, invites]);
};

/** Backward-compatible provider that composes FriendsProvider, NotificationsProvider, and InvitesProvider. */
export const SocialProvider = ({ children }: { children: ReactNode }) => (
  <FriendsProvider>
    <NotificationsProvider>
      <InvitesProvider>
        {children}
      </InvitesProvider>
    </NotificationsProvider>
  </FriendsProvider>
);
