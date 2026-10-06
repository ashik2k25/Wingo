import React, { useState } from 'react';
import { X, Download, Smartphone, Globe, Check, Share2, ArrowRight, ExternalLink } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
}) => {
  const [copied, setCopied] = useState(false);
  const appUrl = typeof window !== 'undefined' && window.location.origin.includes('run.app')
    ? window.location.origin
    : 'https://ais-dev-ppfvlruiso2uh2zqpm3cx5-966956186649.asia-east1.run.app';

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        onClose();
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl border border-[#21483c] bg-[#0c2822] p-5 sm:p-6 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header with Royal Icon */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21483c]/60">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Number Shot Pro"
              className="w-11 h-11 rounded-2xl border border-[#21483c] object-cover shadow-md"
            />
            <div>
              <h3 className="text-base font-extrabold text-[#e9fff4] flex items-center gap-1.5">
                <span>Number Shot Pro</span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#25c98e] text-[#04221a]">
                  APK
                </span>
              </h3>
              <p className="text-[11px] text-[#91aaa0]">
                Android APK ডাউনলোড ও ইনস্টল গাইড
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#91aaa0] hover:text-[#e9fff4] hover:bg-[#14362e] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-3.5 pt-3 overflow-y-auto flex-1 text-xs">
          {/* PWABuilder 1-Click APK Generator Guide */}
          <div className="p-3.5 rounded-2xl bg-[#14362e] border border-[#25c98e]/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#25c98e] uppercase tracking-wider flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                <span>PWABuilder .APK ফাইল ডাউনলোড</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#25c98e]/20 text-[#25c98e] font-bold">
                100% Validated
              </span>
            </div>
            <p className="text-[11px] text-[#e9fff4] leading-relaxed">
              Manifest description ও আইকন ১০০% ফিক্স করা হয়েছে। সরাসরি ইনস্টলযোগ্য <strong className="text-[#25c98e]">.apk</strong> ফাইল পেতে:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#91aaa0]">
              <li>নিচের বক্স থেকে <strong className="text-[#e9fff4]">Copy</strong> বাটনে চাপ দিয়ে লিংকটি কপি করুন।</li>
              <li><strong className="text-[#e9fff4]">pwabuilder.com</strong> সাইটে গিয়ে লিংকটি পেস্ট করে Start দিন।</li>
              <li><strong className="text-[#e9fff4]">Android</strong> কার্ডে চাপ দিয়ে <strong>Download Package (.apk)</strong> সংগ্রহ করুন।</li>
            </ol>
            <a
              href="https://www.pwabuilder.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 w-full h-9 rounded-xl bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Open PWABuilder.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Copy Direct App Link */}
          <div className="p-3 rounded-2xl bg-[#061b17] border border-[#21483c] space-y-1.5">
            <span className="text-[10px] font-bold text-[#91aaa0] uppercase tracking-wider block">
              Direct App URL (PWABuilder এ পেস্ট করার জন্য):
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 h-9 px-3 rounded-lg bg-[#0c2822] border border-[#21483c] text-[11px] font-mono text-[#e9fff4] truncate"
              />
              <button
                onClick={handleCopyLink}
                className="h-9 px-3.5 rounded-lg bg-[#14362e] hover:bg-[#173d33] border border-[#21483c] text-xs font-bold text-[#25c98e] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Method 2: Direct Install on Android Chrome without APK */}
          <div className="p-3.5 rounded-2xl bg-[#061b17] border border-[#21483c]">
            <div className="flex items-center gap-2 mb-1.5 text-[#f1c97a]">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                ফোনে ১-ক্লিকে ইনস্টল (PWA APK Mode):
              </span>
            </div>
            <p className="text-[11px] text-[#91aaa0] leading-relaxed">
              সরাসরি ক্রোম ব্রাউজারের ৩ ডট মেনু (<strong className="text-[#e9fff4]">⋮</strong>) চাপুন &gt; <strong className="text-[#25c98e]">"Install app"</strong> অথবা <strong className="text-[#25c98e]">"Add to Home screen"</strong> চাপলে নতুন আইকনসহ ফুলস্ক্রিন অ্যাপ হিসেবে ফোনে ইনস্টল হয়ে যাবে।
            </p>
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full h-9 rounded-xl bg-[#14362e] hover:bg-[#173d33] border border-[#25c98e]/40 text-[#25c98e] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Quick Install Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Close */}
        <div className="pt-3 border-t border-[#21483c]/60 mt-1">
          <button
            onClick={onClose}
            className="w-full h-9 rounded-xl bg-[#14362e] hover:bg-[#173d33] border border-[#21483c] text-xs font-bold text-[#91aaa0] hover:text-[#e9fff4] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
