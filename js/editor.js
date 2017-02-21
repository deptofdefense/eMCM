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
		wrappingIndent: 'same'
	}

	var PARTS, KEYED_PARTS
	var selectedPart

	loadEditor()
	loadToc()

	var editor
	function loadEditor() {
		require.config({paths: {'vs': '/vs'}})
		require(['vs/editor/editor.main'], function() {
			editor = monaco.editor.create(document.getElementById('editor'), EDITOR_CONFIG)

			editor.onDidChangeModelContent(function() {
				updatePreview()
			})

			var resize = debounce(editor.layout.bind(editor), 100)
			window.addEventListener('resize', resize)

			if (PARTS) {
				selectPart(PARTS[0])
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
				selectPart(PARTS[0])
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
			} else if (href.length > 1) {
				selectPart(KEYED_PARTS[href.substr(1)])
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
		selectedPart = part
		editor.setValue(part.content)
		updatePreview()
	}

	var previewFrame = document.getElementById('preview')
	function updatePreview() {
		var body = previewFrame.contentWindow.document.getElementById('content')
		body.innerHTML = contentize(editor.getValue())
		fixListElements(body)
	}

	// partsSelect.addEventListener('change', function(event) {
	// 	var part = PARTS[partsSelect.value]
	// 	SELECTED_PART = part
	// 	chaptersSelect.style.display = part.children ? 'block' : 'none'
	// 	if (part.children) {
	// 		chaptersSelect.innerHTML = ''
	// 		part.children.forEach(function(child, i) {
	// 			var option = document.createElement('option')
	// 			option.value = i
	// 			option.innerHTML = child.index + ' - ' + child.title
	// 			chaptersSelect.appendChild(option)
	// 		})

	// 		$(chaptersSelect).trigger('change')
	// 	} else {
	// 		editor.setValue(part.content)
	// 	}
	// })

	// chaptersSelect.addEventListener('change', function(event) {
	// 	var chapter = SELECTED_PART.children[chaptersSelect.value]
	// 	SELECTED_CHAPTER = chapter
	// 	rulesSelect.style.display = chapter.children ? 'block' : 'none'
	// 	if (chapter.children) {
	// 		rulesSelect.innerHTML = ''
	// 		chapter.children.forEach(function(child, i) {
	// 			var option = document.createElement('option')
	// 			option.value = i
	// 			option.innerHTML = child.index + ' - ' + child.title
	// 			rulesSelect.appendChild(option)
	// 		})

	// 		$(rulesSelect).trigger('change')
	// 	} else {
	// 		editor.setValue(chapter.content)
	// 	}
	// })

	// rulesSelect.addEventListener('change', function(event) {
	// 	SELECTED_RULE = SELECTED_CHAPTER.children[rulesSelect.value]
	// 	editor.updateOptions({value: SELECTED_RULE.content})
	// })
})