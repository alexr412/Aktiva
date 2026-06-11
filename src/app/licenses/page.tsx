import { Metadata } from 'next';
import { Code, ExternalLink } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Open-Source-Lizenzen - Aktiva',
  description: 'Informationen über Open-Source-Bibliotheken und Lizenzen, die in der Aktiva App verwendet werden.',
};

export default function LicensesPage() {
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
    <LegalLayout
      title="OSS Lizenzen"
      versionText="Third Party Acknowledgements"
      icon={Code}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
        Aktiva nutzt unter anderem folgende Bibliotheken. Vollständige Lizenztexte sind über die jeweiligen Links einsehbar.
      </p>

      <div className="grid gap-3 not-prose">
        {libraries.map((lib) => (
          <a 
            key={lib.name} 
            href={lib.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-slate-100 dark:border-neutral-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-neutral-700/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 hover:underline">
              {lib.name}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{lib.license}</span>
          </a>
        ))}
      </div>

      <div className="mt-8 p-6 bg-slate-100 dark:bg-neutral-950/50 rounded-2xl not-prose">
        <p className="text-[10px] font-mono text-slate-500 dark:text-neutral-500 leading-relaxed whitespace-pre-wrap">
          {`THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}
        </p>
      </div>
    </LegalLayout>
  );
}
