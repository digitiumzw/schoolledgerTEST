import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function GlobalTopLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isActive = isFetching > 0 || isMutating > 0;

  const [visible, setVisible] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    if (isActive) {
      setComplete(false);
      setVisible(true);
    } else if (visible) {
      setComplete(true);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setComplete(false);
      }, 400);
    }

    return () => clearTimeout(hideTimer);
  }, [isActive, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden print:hidden"
    >
      <div
        className={[
          'h-full bg-primary transition-all ease-in-out',
          complete
            ? 'w-full opacity-0 duration-300'
            : 'opacity-100 duration-[2000ms]',
          !complete ? 'w-[85%]' : '',
        ].join(' ')}
        style={complete ? { width: '100%' } : undefined}
      />
    </div>
  );
}
