import type { ReactNode } from 'react';
import { AudioLines, ShieldAlert, TrendingUp } from 'lucide-react';
import { APP_NAME } from '@/constants/routes';

const FEATURES = [
  { icon: AudioLines, title: 'Daily voice brief', desc: 'A spoken Nepali summary of your day.' },
  { icon: ShieldAlert, title: 'Credit risk', desc: 'Know which customers may not repay.' },
  { icon: TrendingUp, title: 'Demand forecast', desc: 'See what to restock before it runs out.' },
];

function Logo({ light = false }: { light?: boolean }) {
  const img = <img src="/karobar_ai_logo.png" alt={APP_NAME} className={light ? 'h-24 w-auto' : 'h-12 w-auto'} />;
  // Red logo would vanish on the red panel, so it sits on a white card there
  return light ? <div className="self-start bg-white rounded-2xl px-6 py-4 shadow-lg shadow-black/10">{img}</div> : img;
}

/** Two-column layout shared by Login and Register. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-white">
      <aside className="hidden md:flex md:w-1/2 bg-linear-to-br from-[#C0111F] via-brand to-[#ff4d2e] text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -left-16 size-64 bg-black/15 rounded-full blur-3xl pointer-events-none" />

        <div className="z-10 flex flex-col gap-8 max-w-lg animate-fade-in">
          <Logo light />
          <div>
            <h1 className="text-4xl lg:text-[44px] font-bold leading-tight tracking-tight">
              The AI copilot for Nepal's kirana shops.
            </h1>
            <p className="mt-4 text-white/75 text-[15px] leading-relaxed">
              Sales, stock, credit and forecasts in one place. Record by voice on the mobile app, dig into the details here.
            </p>
          </div>
        </div>

        <ul className="z-10 grid grid-cols-3 gap-3 animate-fade-in">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="bg-black/10 border border-white/10 p-4 rounded-2xl flex flex-col gap-2">
              <div className="size-8 bg-white/15 rounded-lg flex items-center justify-center">
                <Icon className="size-4" />
              </div>
              <div className="text-[13px] font-semibold">{title}</div>
              <div className="text-[11px] text-white/70 leading-relaxed">{desc}</div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:px-16">
        <div className="w-full max-w-sm flex flex-col gap-7 py-8 animate-slide-right">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
