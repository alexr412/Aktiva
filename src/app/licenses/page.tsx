'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function LicensesPage() {
  const router = useRouter();
  const language = useLanguage();

  const libraries = [
    { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
    { name: 'Next.js', license: 'MIT', url: 'https://github.com/vercel/next.js/blob/canary/license.md' },
    { name: 'Lucide React', license: 'ISC', url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE' },
    { name: 'Firebase SDK', license: 'Apache-2.0', url: 'https://github.com/firebase/firebase-js-sdk/blob/master/LICENSE' },
    { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE' },
    { name: 'Framer Motion', license: 'MIT', url: 'https://github.com/framer/motion/blob/main/LICENSE' },
    { name: 'Radix UI', license: 'MIT', url: 'https://github.com/radix-ui/primitives/blob/main/LICENSE' },
    { name: 'Shadcn UI', license: 'MIT', url: 'https://github.com/shadcn/ui/blob/main/LICENSE' },
    { name: 'Zod', license: 'MIT', url: 'https://github.com/colinhacks/zod/blob/master/LICENSE' },
    { name: 'SWR', license: 'MIT', url: 'https://github.com/vercel/swr/blob/main/LICENSE' },
    { name: 'Date-fns', license: 'MIT', url: 'https://github.com/date-fns/date-fns/blob/master/LICENSE.md' },
    { name: 'clsx', license: 'MIT', url: 'https://github.com/lukeed/clsx/blob/master/LICENSE' },
    { name: 'tailwind-merge', license: 'MIT', url: 'https://github.com/dcastil/tailwind-merge/blob/main/LICENSE' },
    { name: 'react-easy-crop', license: 'MIT', url: 'https://github.com/valentin_g/react-easy-crop/blob/master/LICENSE' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Code className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">{language === 'de' ? 'Open-Source-Lizenzen' : 'OSS Licenses'}</span>
        </h1>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="p-8 bg-slate-50 dark:bg-neutral-900 rounded-[2rem] border-none">
            <div className="flex gap-4 mb-8">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Code className="w-6 h-6 text-primary" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Software Lizenzen</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Third Party Acknowledgements</p>
               </div>
            </div>
            
              <div className="space-y-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  Aktvia nutzt unter anderem folgende Bibliotheken. Vollständige Lizenztexte sind in der App unter "Rechtliches - Lizenzen" (Link siehe unten) hinterlegt.
                </p>

                <div className="grid gap-3">
                  {libraries.map((lib) => (
                    <div key={lib.name} className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-slate-100 dark:border-neutral-700 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{lib.name}</span>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">{lib.license}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 p-6 bg-slate-100 dark:bg-neutral-950/50 rounded-2xl">
                <p className="text-[10px] font-mono text-slate-500 dark:text-neutral-500 leading-relaxed whitespace-pre-wrap">
                  {`THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}
                </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
