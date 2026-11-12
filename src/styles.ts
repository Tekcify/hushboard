// Shared style entry for both windows: bundled fonts (works offline), tokens, design-system
// components, then the app's own layout.
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "../design-system/project/components/bundle.css";
import "./app.css";
import { installTokens } from "./tokens";

installTokens();
