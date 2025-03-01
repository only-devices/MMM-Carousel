/* global Module Log MM KeyHandler */

let globalThis;

Module.register("MMM-Carousel", {
  defaults: {
    transitionInterval: 10000,
    slideFadeInSpeed: 1000,
    slideFadeOutSpeed: 1000,
    ignoreModules: [],
    skipEmptyModules: true, // New option to control empty module skipping
    mode: "global", // global || positional || slides
    top_bar: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    top_left: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    top_center: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    top_right: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    upper_third: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    middle_center: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    lower_third: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    bottom_left: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    bottom_center: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    bottom_right: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    bottom_bar: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    fullscreen_above: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    fullscreen_below: {
      enabled: false,
      ignoreModules: [],
      overrideTransitionInterval: undefined
    },
    slides: [[]],
    showPageIndicators: true,
    showPageControls: true,
    // MMM-KeyBindings mapping.
    keyBindings: {
      enabled: true
    },
    transitionTimeout: 0,
    homeSlide: 0
  },

  keyBindings: {
    mode: "DEFAULT",
    map: {
      NextSlide: "ArrowRight",
      PrevSlide: "ArrowLeft",
      Pause: "ArrowDown",
      Slide0: "Home"
    }
  },

  start () {
    Log.info(`Starting module: ${this.name} with identifier: ${this.identifier}`);
    globalThis = this;
  },

  validKeyPress (kp) {
    if (kp.keyName === this.keyHandler.config.map.NextSlide) {
      this.manualTransition(undefined, 1);
      this.restartTimer();
    } else if (kp.keyName === this.keyHandler.config.map.PrevSlide) {
      this.manualTransition(undefined, -1);
      this.restartTimer();
    } else if (kp.keyName === this.keyHandler.config.map.Pause) {
      this.toggleTimer();
    } else if (this.keyHandler.reverseMap[kp.keyName].startsWith("Slide")) {
      const goToSlide = this.keyHandler.reverseMap[kp.keyName].match(/Slide([0-9]+)/iu);
      Log.debug(`[MMM-Carousel] ${typeof goToSlide[1]} ${goToSlide[1]}`);
      if (typeof parseInt(goToSlide[1], 10) === "number") {
        this.manualTransition(parseInt(goToSlide[1], 10));
        this.restartTimer();
      }
    }
  },

  notificationReceived (notification, payload, sender) {
    let position;
    const positions = [
      "top_bar",
      "bottom_bar",
      "top_left",
      "bottom_left",
      "top_center",
      "bottom_center",
      "top_right",
      "bottom_right",
      "upper_third",
      "middle_center",
      "lower_third",
      "fullscreen_above",
      "fullscreen_below"
    ];
    if (notification === "MODULE_DOM_CREATED") {
      // Register Key Handler
      if (
        this.config.keyBindings.enabled &&
        MM.getModules().filter((kb) => kb.name === "MMM-KeyBindings").length > 0
      ) {
        this.keyBindings = {
          ...this.keyBindings,
          ...this.config.keyBindings
        };
        KeyHandler.register(this.name, {
          validKeyPress: (kp) => {
            this.validKeyPress(kp); // Your Key Press Function
          }
        });
        this.keyHandler = KeyHandler.create(this.name, this.keyBindings);
      }

      /*
       * Initially, all modules are hidden except the first and any ignored modules
       * We start by getting a list of all of the modules in the transition cycle
       */
      if (this.config.mode === "global" || this.config.mode === "slides") {
        this.setUpTransitionTimers(null);
      } else {
        for (position = 0; position < positions.length; position += 1) {
          if (this.config[positions[position]].enabled === true) {
            this.setUpTransitionTimers(positions[position]);
          }
        }
      }

      const api = {
        module: "MMM-Carousel",
        path: "carousel",
        actions: {
          next: {
            notification: "CAROUSEL_NEXT",
            prettyName: "Next Slide"
          },
          previous: {
            notification: "CAROUSEL_PREVIOUS",
            prettyName: "Previous Slide"
          }
        }
      };
      if (this.config.mode === "slides") {
        Object.keys(this.config.slides).forEach((s) => {
          api.actions[s.replace(/\s/gu, "").toLowerCase()] = {
            notification: "CAROUSEL_GOTO",
            payload: {slide: s},
            prettyName: `Go To Slide ${s}`
          };
        });
      }
      this.sendNotification("REGISTER_API", api);
    }

    if (this.keyHandler && this.keyHandler.validate(notification, payload)) {
      return;
    }

    if (notification === "KEYPRESS") Log.debug(`[MMM-Carousel] notification ${notification} from ${sender.name}`);

    if (notification === "CAROUSEL_NEXT") {
      this.manualTransition(undefined, 1);
      this.restartTimer();
    } else if (notification === "CAROUSEL_PREVIOUS") {
      this.manualTransition(undefined, -1);
    } else if (notification === "CAROUSEL_PLAYPAUSE") {
      this.toggleTimer();
      this.restartTimer();
    } else if (notification === "CAROUSEL_GOTO") {
      if (typeof payload === "number" || typeof payload === "string") {
        try {
          this.manualTransition(parseInt(payload, 10) - 1);
          this.restartTimer();
        } catch {
          Log.error(`Could not navigate to slide ${payload}`);
        }
      } else if (typeof payload === "object") {
        try {
          this.manualTransition(undefined, 0, payload.slide);
          this.restartTimer();
        } catch {
          Log.error(`Could not navigate to slide ${payload.slide}`);
        }
      }
    }
  },

  setUpTransitionTimers (positionIndex) {
    let timer = this.config.transitionInterval;
    const modules = MM.getModules()
      .exceptModule(this)
      .filter((module) => {
        if (positionIndex === null) {
          return this.config.ignoreModules.indexOf(module.name) === -1;
        }
        return (
          this.config[positionIndex].ignoreModules.indexOf(module.name) ===
          -1 && module.data.position === positionIndex
        );
      }, this);

    if (this.config.mode === "slides") {
      modules.slides = this.config.slides;
    }

    if (positionIndex !== null) {
      if (
        this.config[positionIndex].overrideTransitionInterval !== undefined &&
        this.config[positionIndex].overrideTransitionInterval > 0
      ) {
        timer = this.config[positionIndex].overrideTransitionInterval;
      }
    }

    modules.currentIndex = -1;
    modules.showPageIndicators = this.config.showPageIndicators;
    modules.showPageControls = this.config.showPageControls;
    modules.slideFadeInSpeed = this.config.slideFadeInSpeed;
    modules.slideFadeOutSpeed = this.config.slideFadeOutSpeed;
    modules.skipEmptyModules = this.config.skipEmptyModules;
    this.moduleTransition.call(modules);

    // Reference to function for manual transitions
    this.manualTransition = this.moduleTransition.bind(modules);

    if (
      this.config.mode !== "slides" ||
      this.config.mode === "slides" && timer > 0
    ) {
      /*
       * We set a timer to cause the page transitions
       * If we're in slides mode and the timer is set to 0, we only use manual transitions
       */
      this.transitionTimer = setInterval(this.manualTransition, timer);
    } else if (
      this.config.mode === "slides" &&
      timer === 0 &&
      this.config.transitionTimeout > 0
    ) {
      this.transitionTimer = setTimeout(() => {
        this.transitionTimeoutCallback();
      }, this.config.transitionTimeout);
    }
  },

  moduleTransition (goToIndex = -1, goDirection = 0, goToSlide = undefined) {
    let noChange = false;
    let resetCurrentIndex = this.length;
    if (this.slides !== undefined) {
      resetCurrentIndex = Object.keys(this.slides).length;
    }

    // Helper function to check if a module's DOM is empty
    const isModuleEmpty = (module) => {
      // Add debug logging to help diagnose the issue
      Log.debug(`[MMM-Carousel] Checking if module ${module.name} is empty`);
      
      // Get the module's DOM element properly
      const moduleElement = document.getElementById(module.identifier);
      if (!moduleElement) {
        Log.debug(`[MMM-Carousel] Module ${module.name} DOM element not found, considering empty`);
        return true;
      }
      
      // For MMM-MyScoreboard, do a specific check for empty scoreboards
      if (module.name === "MMM-MyScoreboard") {
        // Log what we're finding to help debug
        const tables = moduleElement.querySelectorAll("table");
        Log.debug(`[MMM-Carousel] Found ${tables.length} tables in MyScoreboard`);
        
        // Check for no data message which indicates empty scoreboard
        const noGames = moduleElement.querySelectorAll(".no-games-message");
        if (noGames && noGames.length > 0) {
          Log.debug(`[MMM-Carousel] Found 'no games' message in MyScoreboard, considering empty`);
          return true;
        }
        
        // If it has any tables at all with content, consider it non-empty
        if (tables.length > 0) {
          // Extra check to see if tables actually have content
          for (let i = 0; i < tables.length; i++) {
            if (tables[i].rows.length > 1) { // More than just a header row
              return false;
            }
          }
        }
        
        // Check for any substantial content
        const content = moduleElement.textContent ? moduleElement.textContent.trim() : "";
        if (content !== "" && 
            !content.includes("No games") && 
            !content.includes("Loading") && 
            content.length > 15) {
          return false;
        }
        
        return true;
      }
      
      // For all other modules, check if there's visible content
      // First, check if the module is hidden by CSS
      const style = window.getComputedStyle(moduleElement);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return true;
      }
      
      // Then check for actual content
      const hasContent = moduleElement.innerHTML && 
                         moduleElement.innerHTML.trim() !== "" &&
                         moduleElement.offsetHeight > 10; // Height threshold to ignore tiny elements
      
      return !hasContent;
    };

    // Function to find the next non-empty index
    const findNextNonEmptyIndex = (startIdx, direction = 1) => {
      if (!this.skipEmptyModules) {
        // If not skipping empty modules, just return the next index
        return (startIdx + direction + resetCurrentIndex) % resetCurrentIndex;
      }
      
      let checkedCount = 0;
      let currentIdx = startIdx;
      
      // Loop through indices until we find a non-empty one or check all
      while (checkedCount < resetCurrentIndex) {
        // Move to next index in the specified direction
        currentIdx = (currentIdx + direction + resetCurrentIndex) % resetCurrentIndex;
        checkedCount++;
        
        // Check if this index has content
        if (this.slides === undefined) {
          // In normal mode, just check if the current module has content
          if (!isModuleEmpty(this[currentIdx])) {
            return currentIdx;
          }
        } else {
          // In slides mode, check if any module in this slide has content
          const slideKey = Object.keys(this.slides)[currentIdx];
          const mods = this.slides[slideKey];
          let hasContent = false;
          
          // Check each module in the slide
          for (let i = 0; i < mods.length; i++) {
            let moduleName = mods[i];
            if (typeof moduleName === "object" && moduleName.name) {
              moduleName = moduleName.name;
            }
            
            // Find the module in our array
            for (let j = 0; j < this.length; j++) {
              if (this[j].name === moduleName) {
                if (!isModuleEmpty(this[j])) {
                  hasContent = true;
                  break;
                }
              }
            }
            if (hasContent) break;
          }
          
          if (hasContent) {
            return currentIdx;
          }
        }
      }
      
      // If we couldn't find any non-empty module, just return the next index
      return (startIdx + direction + resetCurrentIndex) % resetCurrentIndex;
    };

    // Update the current index
    if (goToSlide) {
      Log.log(`[MMM-Carousel] In goToSlide, current slide index${this.currentIndex}`);
      Object.keys(this.slides).find((s, j) => {
        if (goToSlide === s) {
          if (j === this.currentIndex) {
            Log.log("[MMM-Carousel] No change, requested slide is the same.");
            noChange = true;
          } else {
            this.currentIndex = j;
            // If we're skipping empty modules, check if this one is empty
            if (this.skipEmptyModules) {
              const slideKey = Object.keys(this.slides)[j];
              const mods = this.slides[slideKey];
              let hasContent = false;
              
              // Check if any module in this slide has content
              for (let i = 0; i < mods.length; i++) {
                let moduleName = mods[i];
                if (typeof moduleName === "object" && moduleName.name) {
                  moduleName = moduleName.name;
                }
                
                // Find the module in our array
                for (let k = 0; k < this.length; k++) {
                  if (this[k].name === moduleName) {
                    if (!isModuleEmpty(this[k])) {
                      hasContent = true;
                      break;
                    }
                  }
                }
                if (hasContent) break;
              }
              
              // If this slide is empty, find the next non-empty one
              if (!hasContent) {
                this.currentIndex = findNextNonEmptyIndex(j, 1);
                // If we looped around to the same slide, don't change
                if (this.currentIndex === j) {
                  noChange = true;
                }
              }
            }
          }
          return true;
        }
        return false;
      });
    } else if (goToIndex === -1) {
      // Go to a specific slide?
      if (goDirection === 0) {
        // Normal Transition, find next non-empty module
        this.currentIndex = findNextNonEmptyIndex(this.currentIndex, 1);
      } else {
        // Told to go a specific direction, find next non-empty module in that direction
        this.currentIndex = findNextNonEmptyIndex(this.currentIndex, goDirection);
      }
    } else if (goToIndex >= 0 && goToIndex < resetCurrentIndex) {
      if (goToIndex === this.currentIndex) {
        Log.debug("[MMM-Carousel] No change, requested slide is the same.");
        noChange = true;
      } else {
        // Go to a specific slide if in range
        this.currentIndex = goToIndex;
        
        // If we're skipping empty modules and this one is empty, find next non-empty
        if (this.skipEmptyModules) {
          let isEmpty = false;
          
          if (this.slides === undefined) {
            isEmpty = isModuleEmpty(this[this.currentIndex]);
          } else {
            const slideKey = Object.keys(this.slides)[this.currentIndex];
            const mods = this.slides[slideKey];
            isEmpty = true;
            
            // Check if any module in this slide has content
            for (let i = 0; i < mods.length; i++) {
              let moduleName = mods[i];
              if (typeof moduleName === "object" && moduleName.name) {
                moduleName = moduleName.name;
              }
              
              // Find the module in our array
              for (let j = 0; j < this.length; j++) {
                if (this[j].name === moduleName) {
                  if (!isModuleEmpty(this[j])) {
                    isEmpty = false;
                    break;
                  }
                }
              }
              if (!isEmpty) break;
            }
          }
          
          // If this slide is empty, find the next non-empty one
          if (isEmpty) {
            const originalIndex = this.currentIndex;
            this.currentIndex = findNextNonEmptyIndex(this.currentIndex, 1);
            // If we looped around to the same slide, don't change
            if (this.currentIndex === originalIndex) {
              noChange = true;
            }
          }
        }
      }
    }

    // Some modules like MMM-RTSPStream get into an odd state if you enable them when already enabled
    Log.debug(`[MMM-Carousel] No change value: ${noChange}`);
    if (noChange === true) {
      return;
    }

    Log.debug(`[MMM-Carousel] Transitioning to slide ${this.currentIndex}`);
    globalThis.sendNotification("CAROUSEL_CHANGED", {slide: this.currentIndex});

    /*
     * selectWrapper(position)
     * Select the wrapper dom object for a specific position.
     *
     * argument position string - The name of the position.
     */
    const selectWrapper = (position) => {
      const classes = position.replace("_", " ");
      const parentWrapper = document.getElementsByClassName(classes);
      if (parentWrapper.length > 0) {
        const wrapper = parentWrapper[0].getElementsByClassName("container");
        if (wrapper.length > 0) {
          return wrapper[0];
        }
      }
      return false;
    };

    // First, hide all modules before showing the new ones
    for (let i = 0; i < this.length; i += 1) {
      this[i].hide(this.slideFadeOutSpeed, false, {lockString: "mmmc"}); // Hide all modules
    }

    setTimeout(() => {
      for (let i = 0; i < this.length; i += 1) {
        /*
         * There is currently no easy way to discover whether a module is ALREADY shown/hidden
         * In testing, calling show/hide twice seems to cause no issues
         */
        Log.debug(`[MMM-Carousel] Processing ${this[i].name}`);
        if (this.slides === undefined && i === this.currentIndex) {
          // In standard mode, show the module (empty check happens during index selection)
          this[i].show(this.slideFadeInSpeed, false, {lockString: "mmmc"});
        } else if (this.slides !== undefined) {
          // Handle slides
          const mods = this.slides[Object.keys(this.slides)[this.currentIndex]];
          let show = false;
          // Loop through all of the modules that are supposed to be in this slide
          for (let s = 0; s < mods.length; s += 1) {
            if (typeof mods[s] === "string" && mods[s] === this[i].name) {
              // If only the module name is given as a string, and it matches, show it
              // (empty checking happens during index selection, not here)
              this[i].show(this.slideFadeInSpeed, false, {
                lockString: "mmmc"
              });
              show = true;
              break;
            } else if (
              typeof mods[s] === "object" &&
              "name" in mods[s] &&
              mods[s].name === this[i].name
            ) {
              /*
               * If the slide definition has an object, and it's name matches the module continue
               * check if carouselId is set (multiple module instances) and this is not the one we should show
               */
              if (
                typeof mods[s].carouselId !== "undefined" &&
                typeof this[i].data.config.carouselId !== "undefined" &&
                mods[s].carouselId !== this[i].data.config.carouselId
              ) {
                break;
              }
              
              // Empty check happens during index selection, not during the show/hide phase
              
              if (typeof mods[s].classes === "string") {
                // Check if we have any classes we're supposed to add
                const dom = document.getElementById(this[i].identifier);
                // Remove any classes added by this module (other slides)
                [dom.className] = dom.className.split("mmmc");
                if (mods[s].classes) {
                  /*
                   * check for an empty classes tag (required to remove classes added from other slides)
                   * If we have a valid class list, add the classes
                   */
                  dom.classList.add("mmmc");
                  dom.classList.add(mods[s].classes);
                }
              }

              if (typeof mods[s].position === "string") {
                // Check if we were given a position to change, if so, move the module to the new position
                selectWrapper(mods[s].position).appendChild(document.getElementById(this[i].identifier));
              }
              // Finally show the module
              this[i].show(this.slideFadeInSpeed, false, {
                lockString: "mmmc"
              });
              show = true;
              break;
            }
          }
          // The module is not in this slide.
          if (!show) {
            this[i].hide(0, false, {lockString: "mmmc"});
          }
        } else {
          // We aren't using slides and this module shouldn't be shown.
          this[i].hide(0, false, {lockString: "mmmc"});
        }
      }
    }, this.slideFadeOutSpeed);

    // Update the DOM if we're using it.
    if (
      this.slides !== undefined &&
      (this.showPageIndicators || this.showPageControls)
    ) {
      const slider = document.getElementById(`slider_${this.currentIndex}`);
      slider.checked = true;

      if (this.showPageIndicators) {
        const currPages = document.getElementsByClassName("mmm-carousel-current-page");
        if (currPages && currPages.length > 0) {
          for (let i = 0; i < currPages.length; i += 1) {
            currPages[i].classList.remove("mmm-carousel-current-page");
          }
        }
        document
          .getElementById(`sliderLabel_${this.currentIndex}`)
          .classList.add("mmm-carousel-current-page");
      }

      if (this.showPageControls) {
        const currBtns = document.getElementsByClassName("mmm-carousel-available");
        if (currBtns && currBtns.length > 0) {
          while (currBtns.length > 0) {
            currBtns[0].classList.remove("mmm-carousel-available");
          }
        }
        if (this.currentIndex !== resetCurrentIndex - 1) {
          Log.debug(`[MMM-Carousel] Trying to enable button sliderNextBtn_${this.currentIndex + 1}`);
          document
            .getElementById(`sliderNextBtn_${this.currentIndex + 1}`)
            .classList.add("mmm-carousel-available");
        }
        if (this.currentIndex !== 0) {
          Log.debug(`[MMM-Carousel] Trying to enable button sliderPrevBtn_${this.currentIndex - 1}`);
          document
            .getElementById(`sliderPrevBtn_${this.currentIndex - 1}`)
            .classList.add("mmm-carousel-available");
        }
      }
    }
  },

  updatePause (paused) {
    this.paused = paused;

    const carousel = document.querySelector(".mmm-carousel-container");

    if (this.paused) carousel.classList.add("mmm-carousel-paused");
    else carousel.classList.remove("mmm-carousel-paused");
  },

  restartTimer () {
    if (this.config.transitionInterval > 0) {
      this.updatePause(false);
      // Restart the timer
      clearInterval(this.transitionTimer);
      this.transitionTimer = setInterval(
        this.manualTransition,
        this.config.transitionInterval
      );
    } else if (this.config.transitionTimeout > 0) {
      this.updatePause(false);
      // Restart the timeout
      clearTimeout(this.transitionTimer);
      this.transitionTimer = setTimeout(() => {
        this.transitionTimeoutCallback();
      }, this.config.transitionTimeout);
    }
  },

  toggleTimer () {
    if (this.config.transitionInterval > 0) {
      if (this.transitionTimer) {
        this.updatePause(true);
        clearInterval(this.transitionTimer);
        this.transitionTimer = undefined;
      } else {
        this.updatePause(false);
        this.transitionTimer = setInterval(
          this.manualTransition,
          this.config.transitionInterval
        );
      }
    } else if (this.config.transitionTimeout > 0) {
      if (this.transitionTimer) {
        this.updatePause(true);
        clearTimeout(this.transitionTimer);
        this.transitionTimer = undefined;
      } else {
        this.updatePause(false);
        this.transitionTimer = setTimeout(() => {
          this.transitionTimeoutCallback();
        }, this.config.transitionTimeout);
      }
    }
  },

  /*
   * This is called when the module is loaded and the DOM is ready.
   * This is the first method called after the module has been registered.
   */
  transitionTimeoutCallback () {
    let goToIndex = -1;
    let goToSlide;
    if (typeof this.config.homeSlide === "number") {
      goToIndex = this.config.homeSlide;
    } else if (typeof this.config.homeSlide === "string") {
      goToSlide = this.config.homeSlide;
    } else {
      goToIndex = 0;
    }
    this.manualTransition(goToIndex, undefined, goToSlide);
    this.restartTimer();
  },

  manualTransitionCallback (slideNum) {
    Log.debug(`manualTransition was called by slider_${slideNum}`);

    // Perform the manual transition
    this.manualTransition(slideNum);
    this.restartTimer();
  },

  getStyles () {
    return ["MMM-Carousel.css"];
  },

  makeOnChangeHandler (id) {
    return () => {
      this.manualTransitionCallback(id);
    };
  },

  /*
   * getDom()
   * This method generates the DOM which needs to be displayed. This method is called by the MagicMirror² core.
   * This method needs to be subclassed if the module wants to display info on the mirror.
   *
   * return DOM object - The DOM to display.
   */
  getDom () {
    const div = document.createElement("div");

    if (
      this.config.mode === "slides" &&
      (this.config.showPageIndicators || this.config.showPageControls)
    ) {
      div.className = "mmm-carousel-container";

      const paginationWrapper = document.createElement("div");
      paginationWrapper.className = "slider-pagination";

      for (let i = 0; i < Object.keys(this.config.slides).length; i += 1) {
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "slider";
        input.id = `slider_${i}`;
        input.className = "slide-radio";
        input.onchange = this.makeOnChangeHandler(i);
        paginationWrapper.appendChild(input);
      }

      if (this.config.showPageIndicators) {
        for (let i = 0; i < Object.keys(this.config.slides).length; i += 1) {
          const label = document.createElement("label");
          label.setAttribute("for", `slider_${i}`);
          label.id = `sliderLabel_${i}`;
          paginationWrapper.appendChild(label);
        }
      }

      div.appendChild(paginationWrapper);

      if (this.config.showPageControls) {
        const nextWrapper = document.createElement("div");
        nextWrapper.className = "next control";

        const previousWrapper = document.createElement("div");
        previousWrapper.className = "previous control";

        for (let j = 0; j < Object.keys(this.config.slides).length; j += 1) {
          if (j !== 0) {
            const nCtrlLabelWrapper = document.createElement("label");
            nCtrlLabelWrapper.setAttribute("for", `slider_${j}`);
            nCtrlLabelWrapper.id = `sliderNextBtn_${j}`;
            nCtrlLabelWrapper.innerHTML =
                "<i class='fa fa-arrow-circle-right'></i>";
            nextWrapper.appendChild(nCtrlLabelWrapper);
          }

          if (j !== Object.keys(this.config.slides).length - 1) {
            const pCtrlLabelWrapper = document.createElement("label");
            pCtrlLabelWrapper.setAttribute("for", `slider_${j}`);
            pCtrlLabelWrapper.id = `sliderPrevBtn_${j}`;
            pCtrlLabelWrapper.innerHTML =
                "<i class='fa fa-arrow-circle-left'></i>";
            previousWrapper.appendChild(pCtrlLabelWrapper);
          }
        }

        div.appendChild(nextWrapper);
        div.appendChild(previousWrapper);
      }
    }
    return div;
  }
});