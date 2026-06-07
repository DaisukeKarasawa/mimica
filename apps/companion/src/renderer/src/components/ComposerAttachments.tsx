import type { ChatAttachment } from "@mimica/shared";
import { chatAttachmentUrl } from "@mimica/shared";

interface ComposerAttachmentsProps {
  sessionId: string;
  attachments: ChatAttachment[];
  disabled?: boolean;
  onRemove: (attachmentId: string) => void;
}

export function ComposerAttachments({
  sessionId,
  attachments,
  disabled,
  onRemove,
}: ComposerAttachmentsProps) {
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
          {!disabled ? (
            <button
              type="button"
              className="composer-attachment-remove"
              aria-label={`${attachment.fileName} を削除`}
              onClick={() => onRemove(attachment.id)}
            >
              ×
            </button>
          ) : null}
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
        <a
          key={attachment.id}
          className="message-attachment"
          href={chatAttachmentUrl(sessionId, attachment.storagePath)}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={chatAttachmentUrl(sessionId, attachment.storagePath)}
            alt={attachment.fileName}
            className="message-attachment-thumb"
          />
        </a>
      ))}
    </div>
  );
}
