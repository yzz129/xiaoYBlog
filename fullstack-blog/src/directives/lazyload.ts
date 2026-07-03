/**
 * @author: 小Y
 * @description: 图片懒加载 (基于 IntersectionObserver，降级为 scroll 事件)
 */

import { throttle } from "lodash-es";
import { getOffset } from "@/utils/dom";

function inView(element: HTMLElement) {
    return (
        element.style.display !== "none" &&
        window.innerHeight + document.documentElement.scrollTop + 20 >= getOffset(element).offsetTop
    );
}

class LazyloadHelper {
    private el: HTMLElement;

    constructor(el: HTMLElement) {
        this.el = el;
    }

    setSrc() {
        if (!this.el.getAttribute("src") && inView(this.el)) {
            this.el.setAttribute("src", this.el.getAttribute("data-src") || "");
        }
    }

    start() {
        this.setSrc();
    }

    handleUpdated() {
        this.setSrc();
    }
}

// Use a single shared IntersectionObserver for all lazyload elements
let sharedObserver: IntersectionObserver | null = null;
const observedElements = new WeakMap<HTMLElement, LazyloadHelper>();

function getSharedObserver(): IntersectionObserver {
    if (!sharedObserver) {
        sharedObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const helper = observedElements.get(entry.target as HTMLElement);
                        if (helper) {
                            helper.setSrc();
                            sharedObserver?.unobserve(entry.target);
                            observedElements.delete(entry.target as HTMLElement);
                        }
                    }
                }
            },
            {
                rootMargin: "200px 0px", // start loading 200px before element enters viewport
            }
        );
    }
    return sharedObserver;
}

// Fallback: scroll-based lazyload for browsers without IntersectionObserver
class ScrollFallbackHelper {
    private el: HTMLElement;
    private onScrollThrottle: () => void;

    constructor(el: HTMLElement) {
        this.el = el;
        this.onScrollThrottle = throttle(() => {
            if (!this.el.getAttribute("src") && inView(this.el)) {
                this.el.setAttribute("src", this.el.getAttribute("data-src") || "");
                this.cleanup();
            }
        }, 200, { leading: true });
    }

    start() {
        if (!this.el.getAttribute("src") && inView(this.el)) {
            this.el.setAttribute("src", this.el.getAttribute("data-src") || "");
            return;
        }
        window.addEventListener("scroll", this.onScrollThrottle, { passive: true });
    }

    handleUpdated() {
        if (!this.el.getAttribute("src") && inView(this.el)) {
            this.el.setAttribute("src", this.el.getAttribute("data-src") || "");
        }
    }

    cleanup() {
        window.removeEventListener("scroll", this.onScrollThrottle);
    }
}

const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";

export default {
    mounted(el: HTMLElement): void {
        if (supportsIntersectionObserver) {
            const helper = new LazyloadHelper(el);
            observedElements.set(el, helper);
            getSharedObserver().observe(el);
            helper.start();
        } else {
            const fallback = new ScrollFallbackHelper(el);
            (el as any).__lazyloadFallback = fallback;
            fallback.start();
        }
    },

    updated(el: HTMLElement): void {
        if (supportsIntersectionObserver) {
            const helper = observedElements.get(el);
            if (helper) {
                helper.handleUpdated();
            }
        } else {
            const fallback = (el as any).__lazyloadFallback as ScrollFallbackHelper | undefined;
            if (fallback) {
                fallback.handleUpdated();
            }
        }
    },

    beforeUnmount(el: HTMLElement): void {
        if (supportsIntersectionObserver) {
            const helper = observedElements.get(el);
            if (helper) {
                sharedObserver?.unobserve(el);
                observedElements.delete(el);
            }
            // Clean up observer if no elements remain
            if (sharedObserver && observedElements.size === 0) {
                sharedObserver.disconnect();
                sharedObserver = null;
            }
        } else {
            const fallback = (el as any).__lazyloadFallback as ScrollFallbackHelper | undefined;
            if (fallback) {
                fallback.cleanup();
            }
        }
    },
};
