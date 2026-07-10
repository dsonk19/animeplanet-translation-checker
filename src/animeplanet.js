export function findMangaLinks(root = document) {
    const links = [
        ...root.querySelectorAll('a[href^="/manga/"]')
    ];

    return links.filter(link => {
        const href = link.getAttribute("href") || "";
        const title = link.textContent
            .replace(/\s+/g, " ")
            .trim();

        if (!/^\/manga\/[^/?#]+\/?$/.test(href)) {
            return false;
        }

        if (!title || title.length < 2 || title.length > 250) {
            return false;
        }

        if (
            link.closest(
                "header, nav, footer, .main-menu, .menu, .breadcrumb"
            )
        ) {
            return false;
        }

        return true;
    });
}

export function getMangaTitle(link) {
    return link.textContent
        .replace(/\s+/g, " ")
        .trim();
}

export function findMangaCard(link) {
    return (
        link.closest(
            "li, article, .card, .item, .entry, .pure-1, .tooltip"
        ) ||
        link.parentElement
    );
}
