import "./globals.css"
import { Inter } from "next/font/google"
import { Metadata } from "next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
    title: "GrandPrixGPT",
    description: "The place to go for all your Formula One questions!"
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="light">
            <body className="bg-white min-h-screen">
                {children}
            </body>
        </html>
    )
}