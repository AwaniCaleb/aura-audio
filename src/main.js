document.addEventListener('DOMContentLoaded', () => {
	// DOM Elements
	const fileInput = document.getElementById('music-input');
	const fileSelectBtn = document.getElementById('file-select-btn');
	const libraryGrid = document.querySelector('.library-grid');
	const libraryList = document.querySelector('.library-list');
	const gridViewBtn = document.querySelector('.grid-view');
	const listViewBtn = document.querySelector('.list-view');
	const searchInput = document.querySelector('.search-input');
	const nowPlaying = document.querySelector('.now-playing');
	const expandBtn = document.querySelector('.expand-btn');
	const minimizeBtn = document.querySelector('.minimize-btn');
	const audioPlayer = document.getElementById('audio-player');
	const playBtns = document.querySelectorAll('.play-btn');
	const prevBtns = document.querySelectorAll('.prev-btn');
	const nextBtns = document.querySelectorAll('.next-btn');
	const progressBar = document.querySelector('.progress');
	const progressContainer = document.querySelector('.progress-bar');
	const currentTimeEl = document.querySelector('.current-time');
	const totalTimeEl = document.querySelector('.total-time');
	const volumeSlider = document.querySelector('.volume-slider');
	const shuffleBtn = document.querySelector('.shuffle-btn');
	const repeatBtn = document.querySelector('.repeat-btn');
	const lyricsToggle = document.querySelector('.lyrics-toggle');
	const lyricsContainer = document.querySelector('.lyrics-container');
	const miniArtwork = document.querySelector('.artwork-mini');
	const fullArtwork = document.querySelector('.full-artwork');
	const miniTitle = document.querySelector('.info-mini .title');
	const miniArtist = document.querySelector('.info-mini .artist');
	const fullTitle = document.querySelector('.track-info .title');
	const fullArtist = document.querySelector('.track-info .artist');
	const visualizerBars = document.querySelectorAll('.visualizer-bar');
	const fileInputContainer = document.querySelector('.file-input-container');

	// State
	let tracks = [];
	let currentTrackIndex = 0;
	let isPlaying = false;
	let isShuffle = false;
	let isRepeat = false;
	let audioContext = null;
	let analyser = null;
	let dataArray = null;

	let showVisualizer = false;
	let visualizerToggleBtn;

	// Event Listeners
	fileSelectBtn.addEventListener('click', () => fileInput.click());
	fileInput.addEventListener('change', handleFileSelect);
	gridViewBtn.addEventListener('click', setGridView);
	listViewBtn.addEventListener('click', setListView);
	searchInput.addEventListener('input', filterTracks);
	expandBtn.addEventListener('click', expandPlayer);
	minimizeBtn.addEventListener('click', minimizePlayer);

	playBtns.forEach(btn => btn.addEventListener('click', togglePlay));
	prevBtns.forEach(btn => btn.addEventListener('click', playPrevious));
	nextBtns.forEach(btn => btn.addEventListener('click', playNext));

	progressContainer.addEventListener('click', seekTo);
	audioPlayer.addEventListener('timeupdate', updateProgress);
	audioPlayer.addEventListener('ended', handleTrackEnd);
	volumeSlider.addEventListener('input', updateVolume);
	shuffleBtn.addEventListener('click', toggleShuffle);
	repeatBtn.addEventListener('click', toggleRepeat);
	lyricsToggle.addEventListener('click', toggleLyrics);

	// Functions
	function handleFileSelect(e) {
		const files = [];
		const items = e.target.files || e.target.webkitEntries || e.target.mozEntries;

		// Process files and directories
		const processEntries = (entries) => {
			return Promise.all(
				Array.from(entries).map((entry) => {
					if (entry.isFile) {
						return new Promise((resolve) => {
							entry.file((file) => {
								if (file.type.startsWith('audio/')) {
									files.push(file);
								}
								resolve();
							});
						});
					} else if (entry.isDirectory) {
						return new Promise((resolve) => {
							const reader = entry.createReader();
							reader.readEntries((subEntries) => {
								processEntries(subEntries).then(resolve);
							});
						});
					}
				})
			);
		};

		// If folders are supported
		if (items && items[0] && items[0].webkitGetAsEntry) {
			const entries = Array.from(items).map((item) => item.webkitGetAsEntry());
			processEntries(entries).then(() => processFiles(files));
		} else {
			// Fallback for regular file input
			Array.from(e.target.files).forEach((file) => {
				if (file.type.startsWith('audio/')) {
					files.push(file);
				}
			});
			processFiles(files);
		}
	}

	function processFiles(files) {
		if (files.length === 0) return;

		tracks = [];
		libraryGrid.innerHTML = '';
		libraryList.innerHTML = '';

		Promise.all(files.map((file) => processFile(file)))
			.then(() => {
				fileInputContainer.style.display = 'none';
				renderTracks();

				if (tracks.length > 0) {
					currentTrackIndex = 0;
					loadTrack(currentTrackIndex);
				}
			});
	}

	function processFile(file) {
		return new Promise((resolve) => {
			const reader = new FileReader();

			reader.onload = function (e) {
				// Create track object
				const track = {
					file: file,
					title: file.name.replace(/\.[^/.]+$/, ""),
					artist: "Unknown Artist",
					album: "Unknown Album",
					duration: 0,
					url: e.target.result
				};

				// Create temporary audio element to get duration
				const tempAudio = new Audio(e.target.result);
				tempAudio.addEventListener('loadedmetadata', () => {
					track.duration = tempAudio.duration;

					// Try to parse ID3 data if available
					parseID3(file).then(metadata => {
						if (metadata.title) track.title = metadata.title;
						if (metadata.artist) track.artist = metadata.artist;
						if (metadata.album) track.album = metadata.album;
						if (metadata.picture) track.picture = metadata.picture;

						tracks.push(track);
						resolve();
					});
				});

				tempAudio.addEventListener('error', () => {
					console.error("Error loading audio file:", file.name);
					resolve();
				});
			};

			reader.readAsDataURL(file);
		});
	}

	function parseID3(file) {
		return new Promise((resolve) => {
			const metadata = {
				title: null,
				artist: null,
				album: null,
				picture: null
			};

			// Basic ID3 parsing - for a real app, use a proper ID3 library
			const reader = new FileReader();

			reader.onload = function () {
				const data = new Uint8Array(reader.result);

				// Check for ID3v2 tag
				if (data[0] === 73 && data[1] === 68 && data[2] === 51) { // "ID3"
					// This is a simplified approach
					// For production, use a proper ID3 library

					// Just return with default metadata for this demo
					resolve(metadata);
				} else {
					resolve(metadata);
				}
			};

			reader.onerror = function () {
				resolve(metadata);
			};

			reader.readAsArrayBuffer(file.slice(0, 128 * 1024)); // Read first 128KB to look for headers
		});
	}

	function renderTracks() {
		libraryGrid.innerHTML = '';
		libraryList.innerHTML = '';

		tracks.forEach((track, index) => {
			// Create grid item
			const gridItem = document.createElement('div');
			gridItem.className = 'track-card';
			gridItem.dataset.index = index;
			gridItem.addEventListener('click', () => {
				currentTrackIndex = index;
				loadTrack(index);
				playTrack();
			});

			const artworkSrc = track.picture ? URL.createObjectURL(new Blob([track.picture])) : '/assets/images/static/default-music-art-1.jpeg';

			gridItem.innerHTML = `
		  <img src="${artworkSrc}" alt="${track.title}" class="artwork">
		  <div class="info">
			<div class="title">${track.title}</div>
			<div class="artist">${track.artist}</div>
		  </div>
		`;

			libraryGrid.appendChild(gridItem);

			// Create list item
			const listItem = document.createElement('div');
			listItem.className = 'track-list-item';
			listItem.dataset.index = index;
			listItem.addEventListener('click', () => {
				currentTrackIndex = index;
				loadTrack(index);
				playTrack();
			});

			listItem.innerHTML = `
		  <img src="${artworkSrc}" alt="${track.title}" class="artwork">
		  <div class="info">
			<div class="title">${track.title}</div>
			<div class="artist">${track.artist}</div>
		  </div>
		  <div class="duration">${formatTime(track.duration)}</div>
		`;

			libraryList.appendChild(listItem);
		});
	}

	function setGridView() {
		gridViewBtn.classList.add('active');
		listViewBtn.classList.remove('active');
		libraryGrid.classList.remove('hidden');
		libraryList.classList.add('hidden');
	}

	function setListView() {
		listViewBtn.classList.add('active');
		gridViewBtn.classList.remove('active');
		libraryList.classList.remove('hidden');
		libraryGrid.classList.add('hidden');
	}

	function filterTracks() {
		const query = searchInput.value.toLowerCase();

		const gridItems = libraryGrid.querySelectorAll('.track-card');
		const listItems = libraryList.querySelectorAll('.track-list-item');

		tracks.forEach((track, index) => {
			const matchesQuery =
				track.title.toLowerCase().includes(query) ||
				track.artist.toLowerCase().includes(query);

			gridItems[index].style.display = matchesQuery ? 'block' : 'none';
			listItems[index].style.display = matchesQuery ? 'flex' : 'none';
		});
	}

	function expandPlayer() {
		nowPlaying.classList.add('expanded');
	}

	function minimizePlayer() {
		nowPlaying.classList.remove('expanded');
	}

	function loadTrack(index) {
		if (tracks.length === 0) return;

		const track = tracks[index];
		audioPlayer.src = track.url;
		audioPlayer.load();

		updateTrackInfo(track);

		// Mark current track in library
		const gridItems = libraryGrid.querySelectorAll('.track-card');
		const listItems = libraryList.querySelectorAll('.track-list-item');

		gridItems.forEach(item => item.classList.remove('playing'));
		listItems.forEach(item => item.classList.remove('playing'));

		if (gridItems[index]) gridItems[index].classList.add('playing');
		if (listItems[index]) listItems[index].classList.add('playing');

		// Reset progress
		progressBar.style.width = '0%';
		currentTimeEl.textContent = '0:00';
		totalTimeEl.textContent = formatTime(track.duration);
	}

	function updateTrackInfo(track) {
		const artworkSrc = track.picture ? URL.createObjectURL(new Blob([track.picture])) : '/assets/images/static/default-music-art-1.jpeg';

		miniArtwork.src = artworkSrc;
		fullArtwork.src = artworkSrc;

		miniTitle.textContent = track.title;
		miniArtist.textContent = track.artist;

		fullTitle.textContent = track.title;
		fullArtist.textContent = track.artist;

		document.title = `${track.title} - ${track.artist} | Aura Audio`;
	}

	function playTrack() {
		audioPlayer.play()
			.then(() => {
				isPlaying = true;
				updatePlayButtons();
				setupAudioAnalyser();
				visualizeAudio();
			})
			.catch(error => {
				console.error("Error playing track:", error);
			});
	}

	function pauseTrack() {
		audioPlayer.pause();
		isPlaying = false;
		updatePlayButtons();
	}

	function togglePlay() {
		if (tracks.length === 0) return;

		if (isPlaying) {
			pauseTrack();
		} else {
			playTrack();
		}
	}

	function updatePlayButtons() {
		playBtns.forEach(btn => {
			btn.innerHTML = isPlaying ? '⏸️' : '▶️';
		});
	}

	function playPrevious() {
		if (tracks.length === 0) return;

		if (audioPlayer.currentTime > 3) {
			// If more than 3 seconds into the song, restart it
			audioPlayer.currentTime = 0;
			return;
		}

		if (isShuffle) {
			currentTrackIndex = getRandomTrackIndex();
		} else {
			currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
		}

		loadTrack(currentTrackIndex);
		playTrack();
	}

	function playNext() {
		if (tracks.length === 0) return;

		if (isShuffle) {
			currentTrackIndex = getRandomTrackIndex();
		} else {
			currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
		}

		loadTrack(currentTrackIndex);
		playTrack();
	}

	function getRandomTrackIndex() {
		if (tracks.length <= 1) return 0;

		// Get random index different from current
		let newIndex;
		do {
			newIndex = Math.floor(Math.random() * tracks.length);
		} while (newIndex === currentTrackIndex);

		return newIndex;
	}

	function updateProgress() {
		const currentTime = audioPlayer.currentTime;
		const duration = audioPlayer.duration || 1;
		const progressPercent = (currentTime / duration) * 100;

		progressBar.style.width = `${progressPercent}%`;
		currentTimeEl.textContent = formatTime(currentTime);

		// Update visualizer
		if (analyser) {
			visualizeAudio();
		}
	}

	function seekTo(e) {
		const width = progressContainer.clientWidth;
		const clickX = e.offsetX;
		const duration = audioPlayer.duration;

		audioPlayer.currentTime = (clickX / width) * duration;
	}

	function formatTime(time) {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60).toString().padStart(2, '0');
		return `${minutes}:${seconds}`;
	}

	function handleTrackEnd() {
		if (isRepeat) {
			audioPlayer.currentTime = 0;
			playTrack();
		} else if (isShuffle) {
			currentTrackIndex = getRandomTrackIndex();
			loadTrack(currentTrackIndex);
			playTrack();
		} else if (currentTrackIndex < tracks.length - 1) {
			playNext();
		} else {
			// Last track ended
			audioPlayer.currentTime = 0;
			pauseTrack();
		}
	}

	function updateVolume() {
		audioPlayer.volume = volumeSlider.value;
	}

	function toggleShuffle() {
		isShuffle = !isShuffle;
		shuffleBtn.style.color = isShuffle ? 'var(--primary)' : '';
	}

	function toggleRepeat() {
		isRepeat = !isRepeat;
		repeatBtn.style.color = isRepeat ? 'var(--primary)' : '';
	}

	function toggleLyrics() {
		if (lyricsContainer.style.display === 'none' || !lyricsContainer.style.display) {
			lyricsContainer.style.display = 'block';
			lyricsToggle.textContent = 'Hide Lyrics';
			// In a real app, you'd fetch lyrics here
			showMockLyrics();
		} else {
			lyricsContainer.style.display = 'none';
			lyricsToggle.textContent = 'Show Lyrics';
		}
	}

	function showMockLyrics() {
		lyricsContainer.innerHTML = '';

		if (tracks.length === 0) return;

		const mockLyrics = [
			"This is where lyrics would appear",
			"When playing your favorite songs",
			"In a real app, we'd fetch them from a service",
			"Or extract them from music files",
			"For now, just enjoy the music",
			"And imagine the lyrics here",
			"Aura Audio - Your personal music player"
		];

		mockLyrics.forEach((line, index) => {
			const lyricLine = document.createElement('div');
			lyricLine.className = 'lyrics-line';
			lyricLine.textContent = line;

			if (index === 2) lyricLine.classList.add('active');

			lyricsContainer.appendChild(lyricLine);
		});
	}

	function setupAudioAnalyser() {
		if (!audioContext) {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 64;

			const source = audioContext.createMediaElementSource(audioPlayer);
			source.connect(analyser);
			analyser.connect(audioContext.destination);

			dataArray = new Uint8Array(analyser.frequencyBinCount);
		}
	}

	function visualizeAudio() {
		if (!analyser) return;

		requestAnimationFrame(visualizeAudio);

		analyser.getByteFrequencyData(dataArray);

		const barCount = visualizerBars.length;
		const step = Math.floor(dataArray.length / barCount) || 1;

		for (let i = 0; i < barCount; i++) {
			const value = dataArray[i * step];
			const percent = value / 255;
			const height = 1 + percent * 40; // Min height 1px, max 40px

			visualizerBars[i].style.height = height + 'px';
		}
	}

	// Initialize with Grid view as default
	setGridView();
});