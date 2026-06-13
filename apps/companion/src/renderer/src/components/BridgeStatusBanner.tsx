interface BridgeStatusBannerProps {
  message: string | null;
}

export function BridgeStatusBanner({ message }: BridgeStatusBannerProps) {
  if (!message) return null;

  return (
    <div className="bridge-status-banner" role="alert">
      {message}
    </div>
  );
}
