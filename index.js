export default {
  async fetch(request, env, ctx) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Imam Mobile Shop | Inventory & Management System</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen flex flex-col justify-between">

    <!-- Header / Nav -->
    <header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="bg-indigo-600 text-white p-2 rounded-lg">
                    <i class="fa-solid fa-mobile-screen-button text-lg"></i>
                </div>
                <span class="font-bold text-lg tracking-wide">Imam Mobile <span class="text-indigo-400">POS</span></span>
            </div>
            <div class="flex items-center space-x-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span class="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    System Online
                </span>
            </div>
        </div>
    </header>

    <!-- Main Hero Section -->
    <main class="max-w-7xl mx-auto px-6 py-20 flex-grow flex flex-col justify-center items-center text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-6">
            <i class="fa-solid fa-graduation-cap"></i> Final Year Project Platform
        </div>
        
        <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight mb-6">
            Smart Mobile Shop <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Database & Management</span>
        </h1>
        
        <p class="text-slate-400 text-lg max-w-xl mb-10">
            A high-performance cloud backend and management dashboard built for tracking mobile inventory, accessories, stock levels, and sales transactions.
        </p>

        <!-- Quick Status Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left mb-12">
            <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-xl">
                <div class="text-indigo-400 text-xl mb-3"><i class="fa-solid fa-server"></i></div>
                <h3 class="font-semibold text-slate-200 mb-1">Cloudflare Edge</h3>
                <p class="text-slate-400 text-sm">Ultra-low latency serverless backend infrastructure deployed globally.</p>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-xl">
                <div class="text-indigo-400 text-xl mb-3"><i class="fa-solid fa-database"></i></div>
                <h3 class="font-semibold text-slate-200 mb-1">Secure Database</h3>
                <p class="text-slate-400 text-sm">Relational storage tracking products, pricing, and active customer sales.</p>
            </div>
            <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-xl">
                <div class="text-indigo-400 text-xl mb-3"><i class="fa-solid fa-shield-halved"></i></div>
                <h3 class="font-semibold text-slate-200 mb-1">Staff Auth</h3>
                <p class="text-slate-400 text-sm">Role-based authentication and secure session management for shop owners.</p>
            </div>
        </div>

        <div class="flex flex-wrap justify-center gap-4">
            <a href="https://github.com/ImamSaahib/imam_mobile" target="_blank" class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition flex items-center gap-2">
                <i class="fa-brands fa-github"></i> View GitHub Repository
            </a>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-500 text-sm">
        <p>Imam Mobile Shop Management System &bull; Final Year Capstone Project</p>
    </footer>

</body>
</html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};
