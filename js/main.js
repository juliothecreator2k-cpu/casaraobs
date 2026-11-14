/*
 * Casarão Beauty Studio
 * JavaScript puro + GSAP (ScrollTrigger, ScrollSmoother, SplitText e DrawSVG).
 * As bibliotecas ficam em js/vendor e são carregadas antes deste arquivo no index.html.
 */
(function () {
  'use strict';

  /* ==========================================================
     GSAP e utilidades
     ========================================================== */
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin);
  gsap.defaults({ ease: 'expo.out', duration: 1 });

  const MQ = {
    motion: '(prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
    desktop: '(min-width: 1024px)',
    fine: '(hover: hover) and (pointer: fine)',
  };

  const prefersReducedMotion = () => window.matchMedia(MQ.reduce).matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const fontsReady = () => (document.fonts ? document.fonts.ready : Promise.resolve());

  /* ==========================================================
     Rolagem
     ========================================================== */
  let smoother = null;

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (smoother) smoother.scrollTo(el, true, 'top top');
    else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function lockScroll(locked) {
    if (smoother) smoother.paused(locked);
    document.documentElement.classList.toggle('is-locked', locked);
  }

  function handleAnchorClick(e) {
    const href = e.currentTarget.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    e.preventDefault();
    scrollToId(href.slice(1));
  }

  // Avisos para as seções: o preloader terminou
  const introCallbacks = [];
  let introDone = prefersReducedMotion();
  const onIntroDone = (fn) => (introDone ? fn() : introCallbacks.push(fn));
  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    introCallbacks.splice(0).forEach((fn) => fn());
  };

  function initButtons() {
    // Links internos (#id) fora do menu usam a rolagem suave
    $$('a[href^="#"]').forEach((a) => {
      if (a.matches('.skip-link, .nav__link, .nav__logo, .menu__link, .menu__foot .btn')) return;
      a.addEventListener('click', handleAnchorClick);
    });
  }

  /* ==========================================================
     ScrollSmoother
     ========================================================== */
  function initSmoother() {
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.15,
        effects: true,
        smoothTouch: false,
      });
      return () => {
        smoother.kill();
        smoother = null;
      };
    });
  }

  /* ==========================================================
     Preloader
     ========================================================== */
  function waitImage(img) {
    if (!img || img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }

  function initPreloader() {
    const root = $('.pre');
    if (!root) return finishIntro();
    if (prefersReducedMotion()) {
      root.remove();
      return finishIntro();
    }

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    lockScroll(true);

    const q = gsap.utils.selector(root);
    const num = q('.pre__num')[0];
    const progress = { v: 0 };

    const intro = gsap.timeline();
    intro
      .fromTo(
        q('.pre__mark .logo__word'),
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'power3.inOut' },
        0.1,
      )
      .from(q('.pre__mark .logo__tag'), { y: 10, autoAlpha: 0, duration: 0.9 }, 0.75)
      .to(
        progress,
        {
          v: 100,
          duration: 1.6,
          ease: 'power2.inOut',
          onUpdate: () => {
            num.textContent = pad(Math.round(progress.v));
          },
        },
        0,
      )
      .fromTo(q('.pre__bar i'), { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0);

    const introFinished = new Promise((resolve) => intro.eventCallback('onComplete', resolve));
    const assets = Promise.all([waitImage($('.hero__bg img')), fontsReady()]);

    Promise.all([introFinished, assets]).then(() => {
      const out = gsap.timeline({ onComplete: () => root.remove() });
      out
        .to(q('.pre__inner'), { y: -36, autoAlpha: 0, duration: 0.7, ease: 'power3.in' })
        .to(root, { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, '-=0.2')
        .fromTo(q('.pre__curve'), { scaleY: 0 }, { scaleY: 1, duration: 0.55, ease: 'power2.in' }, '<')
        .to(q('.pre__curve'), { scaleY: 0, duration: 0.6, ease: 'power2.out' }, '>')
        .add(() => {
          lockScroll(false);
          finishIntro();
        }, '-=1.05');
    });
  }

  /* ==========================================================
     Menu (pílula, sublinhado ativo, menu mobile)
     ========================================================== */
  function initNav() {
    const nav = $('.nav');
    const pill = $('.nav__pill');
    const line = $('.nav__line');
    const menu = $('#menu-mobile');
    const toggle = $('.nav__toggle');
    const toggleText = $('.sr-only', toggle);
    const links = {};
    $$('.nav__link').forEach((a) => (links[a.getAttribute('href').slice(1)] = a));
    const ids = Object.keys(links);

    let active = 'inicio';
    let open = false;
    let hidden = false;

    // Sublinhado que corre até o link da seção ativa
    function placeLine(id, instant = false) {
      const el = links[id];
      if (!el || el.offsetParent === null) {
        gsap.set(line, { autoAlpha: 0 });
        return;
      }
      const a = el.getBoundingClientRect();
      const b = pill.getBoundingClientRect();
      gsap.to(line, {
        x: a.left - b.left,
        width: a.width,
        autoAlpha: 1,
        duration: instant ? 0 : 0.8,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    }

    function setActive(id) {
      if (id === active) return;
      active = id;
      ids.forEach((k) => {
        links[k].classList.toggle('is-active', k === id);
        if (k === id) links[k].setAttribute('aria-current', 'true');
        else links[k].removeAttribute('aria-current');
      });
      placeLine(id);
    }

    placeLine(active);
    window.addEventListener('resize', () => placeLine(active, true));
    fontsReady().then(() => placeLine(active, true));

    // Entrada junto com a hero
    if (window.matchMedia(MQ.motion).matches) gsap.set(pill, { autoAlpha: 0, y: -24 });
    onIntroDone(() => gsap.to(pill, { autoAlpha: 1, y: 0, duration: 1.3, delay: 0.25, ease: 'expo.out' }));

    // Esconde ao descer, mostra ao subir
    function setHidden(hide) {
      if (hidden === hide) return;
      hidden = hide;
      gsap.to(nav, { yPercent: hide ? -180 : 0, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
    }

    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 40);
        if (open) return;
        if (y > window.innerHeight * 0.6 && self.direction === 1) setHidden(true);
        else if (self.direction === -1 || y < 120) setHidden(false);
      },
    });

    // Seção ativa
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 45%',
        end: 'bottom 45%',
        refreshPriority: -1,
        onToggle: (self) => self.isActive && setActive(id),
      });
    });

    // Menu mobile
    const mq = gsap.utils.selector(menu);
    const menuTl = gsap.timeline({ paused: true });
    menuTl
      .set(menu, { visibility: 'visible' })
      .fromTo(
        menu,
        { clipPath: 'circle(0% at 90% 6%)' },
        { clipPath: 'circle(150% at 90% 6%)', duration: 0.95, ease: 'power3.inOut' },
      )
      .fromTo(mq('.menu__link > span'), { yPercent: 110 }, { yPercent: 0, stagger: 0.07, duration: 0.9 }, 0.32)
      .fromTo(mq('.menu__foot > *'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.8 }, 0.5);

    function toggleMenu(next) {
      open = typeof next === 'boolean' ? next : !open;
      toggle.classList.toggle('is-open', open);
      nav.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggleText.textContent = open ? 'Fechar menu' : 'Abrir menu';
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      lockScroll(open);
      if (open) {
        hidden = false;
        gsap.to(nav, { yPercent: 0, duration: 0.4 });
        menuTl.timeScale(1).play();
      } else {
        menuTl.timeScale(1.7).reverse();
      }
    }

    toggle.addEventListener('click', () => toggleMenu());
    window.addEventListener('keydown', (e) => e.key === 'Escape' && open && toggleMenu(false));

    function go(e, id) {
      e.preventDefault();
      if (open) {
        toggleMenu(false);
        gsap.delayedCall(0.55, () => scrollToId(id));
      } else {
        scrollToId(id);
      }
    }

    $$('.nav__link, .nav__logo, .menu__link').forEach((a) =>
      a.addEventListener('click', (e) => go(e, a.getAttribute('href').slice(1))),
    );
    $$('.menu__foot .btn').forEach((a) => a.addEventListener('click', (e) => go(e, 'agendar')));
  }

  /* ==========================================================
     Hero
     ========================================================== */
  function initHero() {
    const root = $('.hero');
    const q = gsap.utils.selector(root);

    // Entrada: montada pausada (escondida sob o preloader) e tocada quando ele sai
    if (window.matchMedia(MQ.motion).matches) {
      gsap.set(q('.hero__title, .hero__lead, .hero__cta'), { autoAlpha: 0 });

      fontsReady().then(() => {
        const tl = gsap.timeline({ paused: true });

        tl.fromTo(q('.hero__bg img'), { scale: 1.2 }, { scale: 1.06, duration: 2.8, ease: 'expo.out' }, 0)
          .from(q('.hero__shade'), { opacity: 0, duration: 1.8, ease: 'power2.out' }, 0)
          .set(q('.hero__title'), { autoAlpha: 1 }, 0.4)
          // Logo: o nome se revela da esquerda para a direita, como no preloader
          .fromTo(
            q('.hero__logo .logo__word'),
            { clipPath: 'inset(0% 100% 0% 0%)', y: 14 },
            { clipPath: 'inset(-20% -5% -20% 0%)', y: 0, duration: 1.6, ease: 'power3.inOut', clearProps: 'clipPath' },
            0.4,
          )
          .from(q('.hero__logo .logo__tag'), { y: 10, autoAlpha: 0, letterSpacing: '0.85em', duration: 1.5, ease: 'power3.out' }, 1)
          .fromTo(
            q('.hero__lead'),
            { y: 14, autoAlpha: 0, letterSpacing: '0.5em' },
            { y: 0, autoAlpha: 1, letterSpacing: '0.32em', duration: 1.6, ease: 'power3.out', clearProps: 'letterSpacing' },
            1.2,
          )
          .fromTo(q('.hero__cta'), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 1.5);

        onIntroDone(() => tl.play());
      });
    }

    // Parallax de rolagem e do mouse
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      const st = { trigger: root, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(q('.hero__bg'), { yPercent: 14, ease: 'none', scrollTrigger: st });
      gsap.to(q('.hero__content'), { y: -80, ease: 'none', scrollTrigger: st });
      gsap.to(q('.hero__content'), {
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { ...st, start: 'top+=8% top', end: '55% top' },
      });
    });

    mm.add(`${MQ.motion} and ${MQ.fine}`, () => {
      const bgX = gsap.quickTo(q('.hero__bg img'), 'x', { duration: 1.4, ease: 'power3' });
      const bgY = gsap.quickTo(q('.hero__bg img'), 'y', { duration: 1.4, ease: 'power3' });
      const move = (e) => {
        bgX((e.clientX / window.innerWidth - 0.5) * -20);
        bgY((e.clientY / window.innerHeight - 0.5) * -10);
      };
      root.addEventListener('pointermove', move);
      return () => root.removeEventListener('pointermove', move);
    });
  }

  /* ==========================================================
     Serviços
     ========================================================== */
  function initServices() {
    const root = $('.services');
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    // Desktop: a seção fica fixa e os cards correm na horizontal
    mm.add(`${MQ.motion} and ${MQ.desktop}`, () => {
      const track = q('.services__track')[0];
      const cards = q('.srv-card');
      const distance = () => track.scrollWidth - window.innerWidth;

      const scroller = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      cards.forEach((card) => {
        gsap.fromTo(
          $('.srv-card__media img', card),
          { xPercent: -9 },
          {
            xPercent: 9,
            ease: 'none',
            scrollTrigger: { trigger: card, containerAnimation: scroller, start: 'left right', end: 'right left', scrub: true },
          },
        );

        gsap.from($$('.srv-card__body > *', card), {
          y: 36,
          autoAlpha: 0,
          stagger: 0.07,
          duration: 1.1,
          scrollTrigger: { trigger: card, containerAnimation: scroller, start: 'left 82%', toggleActions: 'play none none reverse' },
        });

        gsap.fromTo(
          $('.srv-card__media', card),
          { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)',
            duration: 1.4,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: card, containerAnimation: scroller, start: 'left 92%', toggleActions: 'play none none reverse' },
          },
        );
      });

      gsap.from(q('.services__outro > *'), {
        y: 30,
        autoAlpha: 0,
        stagger: 0.08,
        scrollTrigger: { trigger: q('.services__outro')[0], containerAnimation: scroller, start: 'left 80%', toggleActions: 'play none none reverse' },
      });
    });

    // Título com linhas reveladas (todas as larguras)
    mm.add(MQ.motion, () => {
      const split = SplitText.create(q('.services__title'), { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      gsap.from(split.lines, { yPercent: 105, stagger: 0.1, duration: 1.3, scrollTrigger: { trigger: root, start: 'top 70%' } });
      return () => split.revert();
    });

    // Mobile e tablet: cards em coluna com revelação simples
    mm.add(`${MQ.motion} and (max-width: 1023px)`, () => {
      q('.srv-card').forEach((card) => {
        gsap.fromTo(
          $('.srv-card__media', card),
          { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)',
            duration: 1.4,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: card, start: 'top 85%' },
          },
        );
        gsap.fromTo(
          $('.srv-card__media img', card),
          { yPercent: -8 },
          { yPercent: 8, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } },
        );
      });
    });
  }

  /* ==========================================================
     Experiência Flow
     ========================================================== */
  function initFlow() {
    const root = $('.flow');
    if (!root) return;
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    mm.add(MQ.motion, () => {
      const title = SplitText.create(q('.flow__title'), { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      const words = SplitText.create(q('.flow__subtitle'), { type: 'words' });
      const bg = q('.flow__bg')[0];
      const photo = q('.flow__photo')[0];

      // Entrada: a fotografia "abre" da direita para a esquerda e o texto chega em camadas
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 72%' },
        onComplete: () => {
          // Desfaz as divisões no fim para nenhum acento ou itálico ficar recortado
          title.revert();
          words.revert();
        },
      });
      tl.fromTo(
        bg,
        { clipPath: 'inset(0% 0% 0% 100%)', scale: 1.18 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 2.1, ease: 'expo.inOut', clearProps: 'clipPath' },
        0,
      )
        .from(q('.flow__shade'), { autoAlpha: 0, duration: 1.6, ease: 'power2.out' }, 0.9)
        .from(q('.flow__ornament .draw'), { drawSVG: '0%', duration: 1.6, stagger: 0.12, ease: 'power2.inOut' }, 0.35)
        .fromTo(
          q('.flow__label'),
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power3.inOut', clearProps: 'clipPath' },
          0.55,
        )
        .from(title.lines, { yPercent: 115, rotate: 3, transformOrigin: '0% 100%', stagger: 0.12, duration: 1.5 }, 0.6)
        .from(q('.flow__title em'), { letterSpacing: '0.06em', duration: 2, ease: 'power3.out' }, 0.75)
        .from(words.words, { y: 14, autoAlpha: 0, filter: 'blur(6px)', stagger: 0.035, duration: 1.1, ease: 'power3.out', clearProps: 'filter' }, 1)
        .from(q('.flow__text'), { y: 26, autoAlpha: 0, duration: 1.2 }, 1.2)
        .from(q('.flow__chef-label'), { x: -16, autoAlpha: 0, duration: 1.1 }, 1.3)
        .from(q('.flow__chef-name'), { y: 18, autoAlpha: 0, filter: 'blur(6px)', duration: 1.2, ease: 'power3.out', clearProps: 'filter' }, 1.4)
        .from(q('.flow__link'), { y: 16, autoAlpha: 0, duration: 1 }, 1.6);

      // Rolagem: a foto se aproxima devagar e o texto flutua num ritmo próprio
      gsap.fromTo(
        photo,
        { scale: 1.1, yPercent: -3 },
        { scale: 1, yPercent: 3, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
      gsap.fromTo(
        q('.flow__content'),
        { y: 50 },
        { y: -50, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } },
      );

      // Luz ambiente: um passeio lento e contínuo, só enquanto a seção está visível
      const glow = gsap
        .timeline({ repeat: -1, yoyo: true, paused: true, defaults: { ease: 'sine.inOut' } })
        .fromTo(q('.flow__glow'), { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: -18, yPercent: 10, scale: 1.12, duration: 7 });
      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? glow.play() : glow.pause()),
      });

      return () => {
        title.revert();
        words.revert();
        glow.kill();
      };
    });

    // Mouse: a fotografia acompanha o cursor de leve (só desktop com mouse)
    mm.add(`${MQ.motion} and ${MQ.fine} and ${MQ.desktop}`, () => {
      const photo = q('.flow__photo')[0];
      const toX = gsap.quickTo(photo, 'x', { duration: 1.4, ease: 'power3.out' });
      const toY = gsap.quickTo(photo, 'y', { duration: 1.4, ease: 'power3.out' });
      const move = (e) => {
        const r = root.getBoundingClientRect();
        toX(((e.clientX - r.left) / r.width - 0.5) * -18);
        toY(((e.clientY - r.top) / r.height - 0.5) * -12);
      };
      const leave = () => {
        toX(0);
        toY(0);
      };
      root.addEventListener('pointermove', move);
      root.addEventListener('pointerleave', leave);
      return () => {
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', leave);
      };
    });
  }

  /* ==========================================================
     Ambiente: a "janela do casarão" que se abre
     ========================================================== */
  function initAmbience() {
    const root = $('.amb');
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    mm.add(MQ.motion, () => {
      const stage = q('.amb__stage')[0];
      const win = q('.amb__window')[0];

      // Arco calculado em px para interpolar sem saltos
      const arch = () => {
        const W = stage.offsetWidth;
        const H = stage.offsetHeight;
        const w = Math.min(W * (W < 700 ? 0.62 : 0.3), 520);
        const h = Math.min(H * 0.66, w * 1.45);
        const side = (W - w) / 2;
        const top = (H - h) / 2;
        return `inset(${top}px ${side}px ${top}px ${side}px round ${w / 2}px ${w / 2}px 12px 12px)`;
      };
      const full = () => 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: stage, start: 'top top', end: '+=140%', pin: true, scrub: 1, invalidateOnRefresh: true },
      });

      tl.fromTo(win, { clipPath: arch }, { clipPath: full, duration: 1, ease: 'power2.inOut' }, 0)
        .fromTo(q('.amb__window img'), { scale: 1.35 }, { scale: 1, duration: 1, ease: 'power2.inOut' }, 0)
        .to(q('.amb__l'), { xPercent: -60, autoAlpha: 0, duration: 0.6 }, 0.05)
        .to(q('.amb__r'), { xPercent: 60, autoAlpha: 0, duration: 0.6 }, 0.05)
        .fromTo(q('.amb__shade'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0.6)
        .fromTo(q('.amb__caption > *'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.35 }, 0.72)
        .to({}, { duration: 0.25 });
    });
  }

  /* ==========================================================
     Depoimentos
     ========================================================== */
  function initTestimonials() {
    const root = $('.tst');
    const track = $('.tst__track', root);
    const cards = $$('.tst__card', root);
    const dotsWrap = $('.tst__dots', root);
    const prevBtn = $('.tst__btn--prev', root);
    const nextBtn = $('.tst__btn--next', root);
    let positions = [];
    let dots = [];

    // Paradas da rolagem lateral (no desktop os cards cabem lado a lado e não há nenhuma)
    function measure() {
      const max = track.scrollWidth - track.clientWidth;
      const base = cards[0].offsetLeft;
      positions = max > 1 ? [...new Set(cards.map((c) => Math.min(c.offsetLeft - base, max)))] : [];
      dotsWrap.innerHTML = positions.map(() => '<i></i>').join('');
      dots = $$('i', dotsWrap);
      update();
    }

    function current() {
      const x = track.scrollLeft;
      return positions.reduce((best, p, k) => (Math.abs(p - x) < Math.abs(positions[best] - x) ? k : best), 0);
    }

    function update() {
      const i = current();
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i >= positions.length - 1;
    }

    function go(dir) {
      const i = Math.max(0, Math.min(positions.length - 1, current() + dir));
      track.scrollTo({ left: positions[i], behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));

    let ticking = false;
    track.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      },
      { passive: true },
    );
    window.addEventListener('resize', measure);
    measure();

    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.from($$('.tst__head > *', root), {
        y: 30,
        autoAlpha: 0,
        stagger: 0.1,
        scrollTrigger: { trigger: root, start: 'top 70%' },
      });
      gsap.from(cards, {
        y: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 1.2,
        scrollTrigger: { trigger: track, start: 'top 85%' },
      });
    });
  }

  /* ==========================================================
     Agendamento
     ========================================================== */
  function initBooking() {
    const root = $('#agendar');
    const q = gsap.utils.selector(root);

    // Entradas na rolagem
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      const split = SplitText.create(q('.bk__title'), { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      gsap.from(split.lines, { yPercent: 105, stagger: 0.1, duration: 1.3, scrollTrigger: { trigger: root, start: 'top 72%' } });
      gsap.from(q('.bk__step'), { y: 34, autoAlpha: 0, stagger: 0.09, duration: 1.1, scrollTrigger: { trigger: q('.bk__steps')[0], start: 'top 80%' } });
      gsap.from(q('.bk__card'), { y: 60, rotate: 2, autoAlpha: 0, duration: 1.5, scrollTrigger: { trigger: q('.bk__card')[0], start: 'top 85%' } });
      gsap.from(q('.bk-info__item'), { y: 30, autoAlpha: 0, stagger: 0.08, scrollTrigger: { trigger: q('.bk-info')[0], start: 'top 88%' } });
      return () => split.revert();
    });
  }

  /* ==========================================================
     Dúvidas frequentes
     ========================================================== */
  function initFaq() {
    const root = $('.faq');
    const items = $$('.faq__item', root);
    let open = items.findIndex((i) => i.classList.contains('is-open'));

    function render(instant) {
      items.forEach((item, i) => {
        const isOpen = i === open;
        const panel = $('.faq__panel', item);
        item.classList.toggle('is-open', isOpen);
        $('.faq__q', item).setAttribute('aria-expanded', String(isOpen));
        // Abre/fecha a resposta animando a altura
        gsap.to(panel, { height: isOpen ? 'auto' : 0, duration: instant ? 0 : 0.8, ease: 'expo.inOut', overwrite: true });
        gsap.to(panel.firstElementChild, {
          y: isOpen ? 0 : -12,
          autoAlpha: isOpen ? 1 : 0,
          duration: instant ? 0 : 0.6,
          delay: isOpen && !instant ? 0.2 : 0,
          overwrite: true,
        });
      });
      // A altura da página mudou: recalcula os gatilhos abaixo
      if (!instant) gsap.delayedCall(0.85, () => ScrollTrigger.refresh());
    }

    items.forEach((item, i) =>
      $('.faq__q', item).addEventListener('click', () => {
        open = open === i ? -1 : i;
        render(prefersReducedMotion());
      }),
    );
    render(true);

    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.from(items, { y: 30, autoAlpha: 0, stagger: 0.07, scrollTrigger: { trigger: $('.faq__list', root), start: 'top 82%' } });
    });
  }

  /* ==========================================================
     Chamada final
     ========================================================== */
  function initFinal() {
    const root = $('.final');
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      const split = SplitText.create(q('.final__title'), { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 65%' } });
      tl.from(split.lines, { yPercent: 105, stagger: 0.1, duration: 1.3 }).from(
        q('.final__text > p, .final__actions'),
        { y: 24, autoAlpha: 0, stagger: 0.1, duration: 1 },
        0.3,
      );
      return () => split.revert();
    });
  }

  /* ==========================================================
     Rodapé
     ========================================================== */
  function initFooter() {
    const root = $('.footer');
    const year = $('[data-year]', root);
    if (year) year.textContent = new Date().getFullYear();
    $('.footer__top-btn', root).addEventListener('click', () => scrollToId('inicio'));

    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.from($('.footer__brand .logo__word', root), {
        clipPath: 'inset(0% 100% 0% 0%)',
        duration: 1.6,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: root, start: 'top 80%' },
      });
      gsap.from($$('.footer__col', root), { y: 30, autoAlpha: 0, stagger: 0.08, scrollTrigger: { trigger: root, start: 'top 75%' } });
    });
  }

  /* ==========================================================
     Botão flutuante do WhatsApp
     ========================================================== */
  function initFab() {
    const el = $('.fab');
    // Fixo e sempre visível: só entra com uma animação quando a página carrega
    gsap.fromTo(el, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.8, delay: 0.6, ease: 'back.out(2)' });
  }

  /* ==========================================================
     Início
     ========================================================== */
  initSmoother();
  initButtons();
  initPreloader();
  initNav();
  initHero();
  initServices();
  initFlow();
  initAmbience();
  initTestimonials();
  initBooking();
  initFaq();
  initFinal();
  initFooter();
  initFab();

  // Recalcula as posições depois que tudo foi criado e quando fontes e imagens carregam
  const refresh = () => {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };
  requestAnimationFrame(refresh);
  fontsReady().then(refresh);
  window.addEventListener('load', refresh);
})();
