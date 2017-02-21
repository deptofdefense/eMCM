document.addEventListener('DOMContentLoaded', function() {
	var EDITOR_CONFIG = {
		value: PARTS ? PARTS[0].content : 'Loading...',
		language: 'html',
		folding: true,
		formatOnPaste: true,
		renderIndentGuides: true,
		renderLineHighlight: 'all',
		lineHeight: 22,
		scrollBeyondLastLine: false,
		useTabStops: true,
		wrappingColumn: 0,
		wordWrap: true,
		wrappingIndent: 'same'
	}

	var PARTS, KEYED_PARTS, CHANGED_PARTS = {}
	var selectedPart

	loadEditor()
	loadToc()

	window.onhashchange = function() {
		var href = location.hash
		var part = KEYED_PARTS[href.substr(1)]
		selectPart(part || PARTS[0])
	}

	var editor
	function loadEditor() {
		require.config({paths: {'vs': '/vs'}})
		require(['vs/editor/editor.main'], function() {
			editor = monaco.editor.create(document.getElementById('editor'), EDITOR_CONFIG)

			editor.onDidChangeModelContent(debounce(onChange, 300))

			window.addEventListener('resize', debounce(resize, 100))

			if (PARTS) {
				window.onhashchange()
			}
		})
	}

	var toc

	function loadToc() {
		toc = document.getElementById('toc')

		fetch('toc.json', function(json) {
			PARTS = JSON.parse(json)
			KEYED_PARTS = arrayToHash(PARTS, 'children')

			forEach(PARTS, function(part, i) {
				makeTocItem(part, i)
			})

			if (editor) {
				window.onhashchange()
			}
		})

		toc.addEventListener('click', function(event) {
			var target = event.target
			if (target.tagName !== 'A') {
				return
			}

			var href = target.getAttribute('href')
			if (href === '#') {
				target.parentNode.classList.toggle('expanded')
				event.stopPropagation()
				event.preventDefault()
			}
		})
	}

	var tocProto = document.getElementById('toc-proto')
	toc.removeChild(tocProto)

	function makeTocItem(part, i, parent) {
		if (!parent) {
			parent = toc
		}

		var li = tocProto.cloneNode(true)
		li.removeAttribute('id')
		part.navItem = li

		var a = li.querySelector('a')
		a.innerHTML = titleForSection(part)
		parent.appendChild(li)

		if (part.children) {
			li.classList.add('has-children')
			a.setAttribute('href', '#')

			var ul = document.createElement('ul')
			li.appendChild(ul)

			forEach(part.children, function (child, i) {
				makeTocItem(child, i, ul)
			})
		} else {
			a.setAttribute('href', '#' + part.id)
		}
	}

	function selectPart(part) {
		if (selectedPart) {
			if (!IS_REVIEWING) {
				selectedPart.newValue = editor.getValue()
			}

			selectedPart.navItem.classList.remove('selected')
		}

		selectedPart = part

		if (selectedPart) {
			selectedPart.navItem.classList.add('selected')
			updatePreview()

			if (IS_REVIEWING) {
				diffEditor.setModel({
					original: monaco.editor.createModel(selectedPart.content, 'html'),
					modified: monaco.editor.createModel(selectedPart.newValue, 'html'),
				})
				diffEditor.layout()
			} else {
				editor.setValue(selectedPart.newValue || selectedPart.content)
				editor.layout()
			}

			if (location.hash !== '#' + selectedPart.id) {
				location.hash = '#' + selectedPart.id
			}
		}
	}

	var previewFrame = document.getElementById('preview')
	function updatePreview() {
		var body = previewFrame.contentWindow.document.getElementById('content')
		body.innerHTML = headerForSection(selectedPart)
		body.innerHTML += contentize(editor.getValue())
		fixListElements(body)
	}

	function onChange() {
		console.log('did change')
		var id = selectedPart.id
		if (!CHANGED_PARTS[id]) {
			CHANGED_PARTS[id] = selectedPart
		}

		updatePreview()
	}

	var reviewToc = document.getElementById('review-toc')
	var reviewChanges = document.getElementById('review-button')
	var cancelReviewChanges = document.getElementById('cancel-review-button')
	var editModeButtons = document.getElementById('edit-mode-buttons')
	var reviewModeButtons = document.getElementById('review-mode-buttons')

	reviewModeButtons.style.display = 'none'

	var diffEditor

	var IS_REVIEWING

	reviewChanges.addEventListener('click', function() {
		if (selectedPart) {
			selectedPart.newValue = editor.getValue()
		}

		reviewToc.innerHTML = ''
		toc.style.display = 'none'

		editModeButtons.style.display = 'none'
		reviewModeButtons.style.display = 'block'

		editor.domElement.style.display = 'none'
		previewFrame.parentNode.style.display = 'none'

		if (diffEditor) {
			document.getElementById('diff').style.display = 'block'
		} else {
			diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff'), EDITOR_CONFIG)
		}

		var first
		Object.forEach(KEYED_PARTS, function(key, part) {
			if (CHANGED_PARTS[key] && part.newValue && part.newValue !== part.content) {
				if (!first) { first = part }
				var newNavItem = part.navItem.cloneNode(true)
				part.oldNavItem = part.navItem
				part.navItem = newNavItem
				reviewToc.appendChild(newNavItem)
			}
		})

		IS_REVIEWING = true

		if (first) {
			selectPart(first)
		}
	})

	cancelReviewChanges.addEventListener('click', function() {
		Object.forEach(CHANGED_PARTS, function(key, part) {
			if (part.oldNavItem) {
				part.navItem = part.oldNavItem
				part.oldNavItem = null
			}
		})

		reviewToc.innerHTML = ''
		toc.style.display = 'block'

		editModeButtons.style.display = 'block'
		reviewModeButtons.style.display = 'none'

		document.getElementById('diff').style.display = 'none'
		editor.domElement.style.display = 'block'
		previewFrame.parentNode.style.display = 'block'

		IS_REVIEWING = false

		selectPart(selectedPart)
	})

	function resize() {
		if (IS_REVIEWING) {
			diffEditor.layout()
		} else {
			editor.layout()
		}
	}
})