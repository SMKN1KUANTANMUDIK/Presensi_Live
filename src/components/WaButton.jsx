import { MessageCircle } from 'lucide-react';
import { openWhatsApp } from '../lib/whatsapp';
import { cn } from '../lib/utils';

/**
 * WaButton — tombol kirim pesan WhatsApp gratis via https://wa.me/.
 * Jika `phone` kosong, WhatsApp tetap terbuka agar guru/piket dapat memilih kontak tujuan.
 */
export default function WaButton({
  phone = '',
  message = '',
  label = 'WA',
  title,
  size = 'sm',
  variant = 'soft',
  className,
  onClick,
}) {
  const hasPhone = Boolean(String(phone || '').replace(/\D/g, '').length >= 9);
  const tooltip =
    title || (hasPhone ? `Kirim pesan WhatsApp ke ${phone}` : 'Buka WhatsApp & pilih kontak orang tua');

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        openWhatsApp(phone, message);
        onClick?.();
      }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold transition active:scale-95',
        size === 'xs' ? 'min-h-8 px-2 text-[10.5px]' : 'min-h-9 px-3 text-[11.5px]',
        variant === 'solid'
          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
          : 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
        className
      )}
    >
      <MessageCircle className={size === 'xs' ? 'size-3.5' : 'size-4'} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
