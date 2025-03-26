import "./globals.css"

export cosnt metadata = {
    title: "F1GPT",
    dewscription: "The plae to go for all your Formula One questions!"
}

const RootLayout = ({ children }) => {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}

export default RootLayout