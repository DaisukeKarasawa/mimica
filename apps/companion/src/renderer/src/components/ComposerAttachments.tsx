import type { ChatAttachment } from "@mimica/shared";
import { chatAttachmentUrl } from "@mimica/shared";

interface ComposerAttachmentsProps {
  sessionId: string;
  attachments: ChatAttachment[];
  onRemove: (attachmentId: string) => void;
}

function AttachmentRemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ComposerAttachments({ sessionId, attachments, onRemove }: ComposerAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="composer-attachments" aria-label="添付画像">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="composer-attachment">
          <img
            src={chatAttachmentUrl(sessionId, attachment.storagePath)}
            alt={attachment.fileName}
            className="composer-attachment-thumb"
          />
          <button
            type="button"
            className="composer-attachment-remove"
            aria-label={`${attachment.fileName} を削除`}
            onClick={() => onRemove(attachment.id)}
          >
            <AttachmentRemoveIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

interface MessageAttachmentsProps {
  sessionId: string;
  attachments: ChatAttachment[];
}

export function MessageAttachments({ sessionId, attachments }: MessageAttachmentsProps) {
  if (!attachments.length) return null;

  return (
    <div className="message-attachments">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="message-attachment">
          <img
            src={chatAttachmentUrl(sessionId, attachment.storagePath)}
            alt={attachment.fileName}
            className="message-attachment-thumb"
          />
        </div>
      ))}
    </div>
  );
}
