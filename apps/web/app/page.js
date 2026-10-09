"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
var image_1 = require("next/image");
var button_1 = require("@repo/ui/button");
var page_module_css_1 = require("./page.module.css");
var ThemeImage = function (props) {
    var srcLight = props.srcLight, srcDark = props.srcDark, rest = __rest(props, ["srcLight", "srcDark"]);
    return (<>
      <image_1.default {...rest} src={srcLight} className="imgLight"/>
      <image_1.default {...rest} src={srcDark} className="imgDark"/>
    </>);
};
function Home() {
    return (<div className={page_module_css_1.default.page}>
      <main className={page_module_css_1.default.main}>
        <ThemeImage className={page_module_css_1.default.logo} srcLight="turborepo-dark.svg" srcDark="turborepo-light.svg" alt="Turborepo logo" width={180} height={38} priority/>
        <ol>
          <li>
            Get started by editing <code>apps/web/app/page.tsx</code>
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className={page_module_css_1.default.ctas}>
          <a className={page_module_css_1.default.primary} href="https://vercel.com/new/clone?demo-description=Learn+to+implement+a+monorepo+with+a+two+Next.js+sites+that+has+installed+three+local+packages.&demo-image=%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F4K8ZISWAzJ8X1504ca0zmC%2F0b21a1c6246add355e55816278ef54bc%2FBasic.png&demo-title=Monorepo+with+Turborepo&demo-url=https%3A%2F%2Fexamples-basic-web.vercel.sh%2F&from=templates&project-name=Monorepo+with+Turborepo&repository-name=monorepo-turborepo&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fturborepo%2Ftree%2Fmain%2Fexamples%2Fbasic&root-directory=apps%2Fdocs&skippable-integrations=1&teamSlug=vercel&utm_source=create-turbo" target="_blank" rel="noopener noreferrer">
            <image_1.default className={page_module_css_1.default.logo} src="/vercel.svg" alt="Vercel logomark" width={20} height={20}/>
            Deploy now
          </a>
          <a href="https://turborepo.dev/docs?utm_source" target="_blank" rel="noopener noreferrer" className={page_module_css_1.default.secondary}>
            Read our docs
          </a>
        </div>
        <button_1.Button appName="web" className={page_module_css_1.default.secondary}>
          Open alert
        </button_1.Button>
      </main>
      <footer className={page_module_css_1.default.footer}>
        <a href="https://vercel.com/templates?search=turborepo&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
          <image_1.default aria-hidden src="/window.svg" alt="Window icon" width={16} height={16}/>
          Examples
        </a>
        <a href="https://turborepo.dev?utm_source=create-turbo" target="_blank" rel="noopener noreferrer">
          <image_1.default aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16}/>
          Go to turborepo.dev →
        </a>
      </footer>
    </div>);
}
