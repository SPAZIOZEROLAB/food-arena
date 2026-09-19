import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Food Arena — il pranzo si propone',description:'Scegli budget e orario di ritiro. I locali ti propongono il pranzo.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}
