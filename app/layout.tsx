import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ViewportHeightProvider } from "@/components/ViewportHeightProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LinguaCoach",
  description: "Spanish conversation practice chat app",
  icons: {
    icon: "/linguacoach_icon.svg",
    apple: "/linguacoach_icon.svg",
  },
  appleWebApp: {
    title: "LinguaCoach",
    statusBarStyle: "black-translucent",
  },
};

// interactive-widget=resizes-content: resizes layout viewport on keyboard open (Android Chrome 108+)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Theme flash prevention: apply theme from localStorage to html[data-theme] before paint */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='espanol'?'espanol':'olive');}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ViewportHeightProvider />
        {children}
      </body>
    </html>
  );
}
