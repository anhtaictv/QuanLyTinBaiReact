import React from 'react';

const Base = ({ size = 18, children, style, ...props }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: 'block', ...style }}
    {...props}
  >
    {children}
  </svg>
);

export const IconGrid = (p) => <Base {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Base>;
export const IconList = (p) => <Base {...p}><path d="M4 5h16M4 12h16M4 19h10"/></Base>;
export const IconPlus = (p) => <Base {...p}><path d="M12 5v14M5 12h14"/></Base>;
export const IconChat = (p) => <Base {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.5 8.5 0 0 1-6-2.6L3 20l1-3.2A8.4 8.4 0 1 1 21 11.5Z"/></Base>;
export const IconKey = (p) => <Base {...p}><circle cx="8" cy="14.5" r="3.2"/><path d="M10.3 12.2 18 4.5M15.5 7l2 2M18 4.5l2 2"/></Base>;
export const IconUsers = (p) => <Base {...p}><circle cx="8.5" cy="8" r="3"/><path d="M2.3 20c0-3.3 2.8-6 6.2-6s6.2 2.7 6.2 6"/><path d="M15.5 5.3c1.1.3 1.9 1.3 1.9 2.5s-.8 2.2-1.9 2.5M21.7 20c0-2.8-2.1-5.1-4.8-5.8"/></Base>;
export const IconLogout = (p) => <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></Base>;
export const IconRefresh = (p) => <Base {...p}><path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/></Base>;
export const IconBell = (p) => <Base {...p}><path d="M12 22a2.5 2.5 0 0 0 2.4-1.8H9.6A2.5 2.5 0 0 0 12 22ZM19 16v-5a7 7 0 0 0-5.4-6.8V3a1.6 1.6 0 1 0-3.2 0v1.2A7 7 0 0 0 5 11v5l-1.6 2.2c-.3.5.02 1.3.6 1.3h15.9c.6 0 1-.8.6-1.3Z"/></Base>;
export const IconBellOff = (p) => <Base {...p}><path d="m3 3 18 18M19 16v-5a7 7 0 0 0-5.4-6.8V3a1.6 1.6 0 1 0-3.2 0v1.2A7 7 0 0 0 5 11v.5M5.2 16 3.4 18.2c-.3.5.02 1.3.6 1.3h11.8"/></Base>;
export const IconAlertTriangle = (p) => <Base {...p}><path d="M10.3 3.9 2.6 18a1.8 1.8 0 0 0 1.6 2.6h15.6a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z"/><path d="M12 9v4.5M12 17h.01"/></Base>;
export const IconAlertCircle = (p) => <Base {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></Base>;
export const IconCheck = (p) => <Base {...p}><path d="M20 6 9 17l-5-5"/></Base>;
export const IconCheckCircle = (p) => <Base {...p}><circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.3 2.3 4.7-5"/></Base>;
export const IconXCircle = (p) => <Base {...p}><circle cx="12" cy="12" r="9"/><path d="m9.5 9.5 5 5m0-5-5 5"/></Base>;
export const IconClock = (p) => <Base {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.5 2.1"/></Base>;
export const IconLock = (p) => <Base {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></Base>;
export const IconUnlock = (p) => <Base {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.5-1.9"/></Base>;
export const IconTrash = (p) => <Base {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6M14 11v6"/></Base>;
export const IconSearch = (p) => <Base {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Base>;
export const IconUser = (p) => <Base {...p}><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5"/></Base>;
export const IconX = (p) => <Base {...p}><path d="M6 6l12 12M18 6 6 18"/></Base>;
export const IconFolder = (p) => <Base {...p}><path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"/></Base>;
export const IconFileText = (p) => <Base {...p}><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></Base>;
export const IconDownload = (p) => <Base {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></Base>;
export const IconEdit = (p) => <Base {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></Base>;
export const IconSettings = (p) => <Base {...p}><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"/></Base>;
export const IconArrowLeft = (p) => <Base {...p}><path d="M19 12H5m0 0 6 6m-6-6 6-6"/></Base>;
export const IconCloudUpload = (p) => <Base {...p}><path d="M7 18a4.5 4.5 0 0 1-.7-8.9 5.5 5.5 0 0 1 10.6-1.8A4.5 4.5 0 0 1 17 18"/><path d="M12 21v-8m0 0-3 3m3-3 3 3"/></Base>;
export const IconLink = (p) => <Base {...p}><path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.6 5A4 4 0 1 1 18 10.4l-1.5 1.5M13 17.5 11.4 19A4 4 0 1 1 6 13.6l1.5-1.5"/></Base>;
export const IconInfo = (p) => <Base {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/></Base>;
export const IconSend = (p) => <Base {...p}><path d="m3 11 18-8-8 18-2-8-8-2Z"/></Base>;
export const IconPaperclip = (p) => <Base {...p}><path d="M21.4 11.5 12.6 20.2a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 1 1-2.8-2.8l7-7"/></Base>;
export const IconImage = (p) => <Base {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 15l-5-5-9 9"/></Base>;
export const IconMenu = (p) => <Base {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Base>;
export const IconChevronDown = (p) => <Base {...p}><path d="m6 9 6 6 6-6"/></Base>;
export const IconSun = (p) => <Base {...p}><circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></Base>;
export const IconMoon = (p) => <Base {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></Base>;
export const IconShield = (p) => <Base {...p}><path d="M12 3.5 19 6.3v5.4c0 5-3 8.2-7 9.8-4-1.6-7-4.8-7-9.8V6.3Z"/><path d="m9 12 2 2 4-4.3"/></Base>;
export const IconExternalLink = (p) => <Base {...p}><path d="M18 13v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h6"/><path d="M14 3h7v7M21 3l-9.5 9.5"/></Base>;
export const IconLoader = (p) => <Base {...p} style={{ animation: 'icon-spin 0.8s linear infinite' }}><path d="M12 3a9 9 0 1 0 9 9"/></Base>;
export const IconEye = (p) => <Base {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></Base>;
export const IconEyeOff = (p) => <Base {...p}><path d="M3 3l18 18"/><path d="M10.6 5.6A10.4 10.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.2 4M6.4 6.9C3.7 8.8 2.5 12 2.5 12S6 18.5 12 18.5a10 10 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></Base>;
export const IconTrendingUp = (p) => <Base {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></Base>;
export const IconServer = (p) => <Base {...p}><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></Base>;
export const IconDatabase = (p) => <Base {...p}><ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5V12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V5.5"/><path d="M4 12v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V12"/></Base>;
export const IconMoreVertical = (p) => <Base {...p} fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></Base>;
export const IconChevronLeft = (p) => <Base {...p}><path d="M15 18l-6-6 6-6"/></Base>;
export const IconChevronRight = (p) => <Base {...p}><path d="M9 18l6-6-6-6"/></Base>;
