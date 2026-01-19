import type React from 'react';
import { getEventSourceLink } from '../constants';

type EventSourceLinkProps = {
  sourceId: number;
  label: string;
  className?: string;
  decorationClassName?: string;
};

const EventSourceLink: React.FC<EventSourceLinkProps> = ({ sourceId, label, className, decorationClassName }) => {
  const link = getEventSourceLink(sourceId);

  if (!link) {
    return <span className={className}>{label}</span>;
  }

  const decorationStyles = decorationClassName ?? 'decoration-slate-500/40 hover:decoration-slate-300/60';
  const linkClassName = `${className ?? ''} underline decoration-dotted underline-offset-2 ${decorationStyles}`.trim();

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <a href={link} target="_blank" rel="noreferrer noopener" className={linkClassName} onClick={handleClick}>
      {label}
    </a>
  );
};

export default EventSourceLink;
