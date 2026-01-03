import { useCallback, useEffect, useRef, useState } from 'react';

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const UPDATE_COUNTDOWN_SECONDS = 10;

const parseLastModified = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const UpdateNotifier = () => {
  const updateCheckTimerRef = useRef<number | null>(null);
  const updateCountdownTimerRef = useRef<number | null>(null);
  const currentLastModifiedRef = useRef<number | null>(null);
  const dismissedLastModifiedRef = useRef<number | null>(null);
  const pendingLastModifiedRef = useRef<number | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [updateCountdown, setUpdateCountdown] = useState<number | null>(null);

  const cancelUpdateRefresh = useCallback(() => {
    if (pendingLastModifiedRef.current != null) {
      dismissedLastModifiedRef.current = pendingLastModifiedRef.current;
    }
    pendingLastModifiedRef.current = null;
    setIsUpdateDialogOpen(false);
    setUpdateCountdown(null);
  }, []);

  const triggerUpdateRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    return () => {
      if (updateCheckTimerRef.current) {
        window.clearInterval(updateCheckTimerRef.current);
      }
      if (updateCountdownTimerRef.current) {
        window.clearTimeout(updateCountdownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isUpdateDialogOpen || updateCountdown == null) {
      return;
    }
    if (updateCountdown <= 0) {
      triggerUpdateRefresh();
      return;
    }
    updateCountdownTimerRef.current = window.setTimeout(() => {
      setUpdateCountdown((prev) => {
        if (prev == null) {
          return prev;
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => {
      if (updateCountdownTimerRef.current) {
        window.clearTimeout(updateCountdownTimerRef.current);
        updateCountdownTimerRef.current = null;
      }
    };
  }, [isUpdateDialogOpen, triggerUpdateRefresh, updateCountdown]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const origin = window.location.origin;
    const initialLastModified = parseLastModified(document.lastModified);
    if (initialLastModified != null) {
      currentLastModifiedRef.current = initialLastModified;
    }

    let isActive = true;
    const checkForUpdate = async () => {
      if (!isActive || pendingLastModifiedRef.current != null) {
        return;
      }
      try {
        const baseUrl = import.meta.env.BASE_URL ?? '/';
        const base = new URL(baseUrl, origin);
        const indexUrl = new URL('index.html', base);
        indexUrl.searchParams.set('t', `${Date.now()}`);
        const response = await fetch(indexUrl.toString(), { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        let nextLastModified = parseLastModified(response.headers.get('last-modified'));
        if (nextLastModified == null) {
          const fallbackResponse = await fetch(indexUrl.toString(), { cache: 'no-store' });
          if (!fallbackResponse.ok) {
            return;
          }
          nextLastModified = parseLastModified(fallbackResponse.headers.get('last-modified'));
        }
        if (!isActive || nextLastModified == null) {
          return;
        }
        const currentLastModified = currentLastModifiedRef.current;
        if (currentLastModified == null) {
          currentLastModifiedRef.current = nextLastModified;
          return;
        }
        if (
          nextLastModified > currentLastModified &&
          dismissedLastModifiedRef.current !== nextLastModified &&
          !isUpdateDialogOpen
        ) {
          pendingLastModifiedRef.current = nextLastModified;
          setIsUpdateDialogOpen(true);
          setUpdateCountdown(UPDATE_COUNTDOWN_SECONDS);
        }
      } catch (error) {
        console.warn('업데이트 확인 중 오류가 발생했습니다.', error);
      }
    };

    void checkForUpdate();
    updateCheckTimerRef.current = window.setInterval(() => {
      void checkForUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      isActive = false;
      if (updateCheckTimerRef.current) {
        window.clearInterval(updateCheckTimerRef.current);
        updateCheckTimerRef.current = null;
      }
    };
  }, [isUpdateDialogOpen]);

  if (!isUpdateDialogOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-[min(92vw,420px)] rounded-2xl border border-blue-200/40 bg-slate-900/90 p-6 text-center shadow-[0_20px_55px_rgba(15,23,42,0.75)]">
        <p className="text-lg font-semibold text-blue-100">새 버전이 감지되었습니다</p>
        <p className="mt-3 text-sm text-slate-200">
          업데이트를 위해 {updateCountdown ?? UPDATE_COUNTDOWN_SECONDS}초 후 자동으로 새로고침 됩니다.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={cancelUpdateRefresh}
            className="inline-flex items-center justify-center rounded-full border border-slate-600/70 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-400 hover:text-white"
          >
            취소
          </button>
          <button
            type="button"
            onClick={triggerUpdateRefresh}
            className="inline-flex items-center justify-center rounded-full border border-blue-400/80 bg-blue-500/20 px-4 py-2 text-sm text-blue-100 shadow-[0_10px_25px_rgba(59,130,246,0.25)] transition hover:border-blue-300 hover:bg-blue-500/30"
          >
            지금 새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotifier;
