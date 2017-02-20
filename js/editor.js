document.addEventListener('DOMContentLoaded', function() {
	var PARTS = []
	var SELECTED_PART, SELECTED_CHAPTER, SELECTED_RULE

	var partsSelect = document.getElementById('parts')
	var chaptersSelect = document.getElementById('chapters')
	var rulesSelect = document.getElementById('rules')

	chaptersSelect.style.display = 'none'
	rulesSelect.style.display = 'none'

	partsSelect.addEventListener('change', function(event) {
		var part = PARTS[partsSelect.value]
		SELECTED_PART = part
		chaptersSelect.style.display = part.children ? 'block' : 'none'
		if (part.children) {
			chaptersSelect.innerHTML = ''
			part.children.forEach(function(child, i) {
				var option = document.createElement('option')
				option.value = i
				option.innerHTML = child.index + ' - ' + child.title
				chaptersSelect.appendChild(option)
			})

			$(chaptersSelect).trigger('change')
		} else {
			editor.setValue(part.content)
		}
	})

	chaptersSelect.addEventListener('change', function(event) {
		var chapter = SELECTED_PART.children[chaptersSelect.value]
		SELECTED_CHAPTER = chapter
		rulesSelect.style.display = chapter.children ? 'block' : 'none'
		if (chapter.children) {
			rulesSelect.innerHTML = ''
			chapter.children.forEach(function(child, i) {
				var option = document.createElement('option')
				option.value = i
				option.innerHTML = child.index + ' - ' + child.title
				rulesSelect.appendChild(option)
			})

			$(rulesSelect).trigger('change')
		} else {
			editor.setValue(chapter.content)
		}
	})

	rulesSelect.addEventListener('change', function(event) {
		SELECTED_RULE = SELECTED_CHAPTER.children[rulesSelect.value]
		editor.updateOptions({value: SELECTED_RULE.content})
	})

	var preview = document.getElementById('preview')

	var editor
	require.config({ paths: { 'vs': '/vs' }});
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor'), {
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
        })

        editor.onDidChangeModelContent(function() {
			var body = preview.contentWindow.document.body
			body.innerHTML = contentize(editor.getValue())
			fixListElements(body)
		})
    })

	fetch('toc.json').then(function(response) {
		return response.json()
	}).then(function(data) {
		console.log(data)

		PARTS = data

		data.forEach(function(part, i) {
			// if (part.children) {
			// 	part.children.forEach(function(child, j) {
			// 		var option = document.createElement('option')
			// 		option.value = i
			// 		option.innerHTML = "Part " + i + " - " + part.title + " - " + j + ": " + child.title
			// 		partsSelect.appendChild(option)
			// 	})
			// } else {
				var option = document.createElement('option')
				option.value = i
				option.innerHTML = "Part " + i + ": " + part.title
				partsSelect.appendChild(option)
			// }
		})

		if (editor) {
			editor.setValue(setValue(data[0].content))
		}
	})

	var REGEXP_TRANSFORMS = [
		[/<(\/?)b/gi, '<$1strong'],
		[/<(\/?)i/gi, '<$1em'],
		[/<(\/?)list/gi, '<$1ol'],
	]

	var URL_REGEXP = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm
	var RCM_REGEXP = /R\.C\.M\.\s*(\d+)((\(\w+\))*)/ig
	var MILREVID_REGEXP = /Mil\.R\.Evid\.\s*(\d+)((\(\w+\))*)/ig
	function contentize(html) {
		REGEXP_TRANSFORMS.forEach(function(transform) {
			html = html.replace(transform[0], transform[1])
		})

		return html.
			replace(URL_REGEXP, '<a href="$&">$&</a>').
			replace(RCM_REGEXP, function(string, rule, sections) {
				sections = sections.replace(/\)\(/g, '-').replace(/\(|\)/g, '')
				var path = ['rcm', rule]
				if (sections) path.push(sections)
				return '<a href="#' + path.join('-') + '">' + string + '</a>'
			}).
			replace(MILREVID_REGEXP, function(string, rule, sections) {
				sections = sections.replace(/\)\(/g, '-').replace(/\(|\)/g, '')
				var path = ['milrevid', rule]
				if (sections) path.push(sections)
				return '<a href="#' + path.join('-') + '">' + string + '</a>'
			})
	}

	var LIST_TYPES = {
		'I': /I/,
		'i': /i/,
		'A': /[A-Z]/,
		'a': /[a-z]/,
		'1': /[0-9]/,
	}

	var ALPHABET = ['a', 'b', 'c', 'd', 'e',
                   'f', 'g', 'h', 'i', 'j',
                   'k', 'l', 'm', 'n', 'o',
                   'p', 'q', 'r', 's', 't',
                   'u', 'v', 'w', 'x', 'y',
                   'z']

	var HASH_PREFIX_REGEXP = /^((rcm|milrevid|art)-\d+)/

	function fixListElements(el) {
		var lists = el.querySelectorAll('ol')
		forEach(lists, function(list) {
			forEach(list.children, function(li) {
				var index = li.getAttribute('index')
				if (li.nodeName.toUpperCase() === 'LI' && index) {
					if (!list.type) {
						for (var listType in LIST_TYPES) {
							if (LIST_TYPES[listType].test(index)) {
								list.type = listType
								break
							}
						}
					}

					if (list.type === '1') {
						li.value = parseInt(index)
					} else if (listType === 'a' || listType === 'A') {
						li.value = ALPHABET.indexOf(index.toLowerCase()) + 1
					}

					var el = li
					while (el = el.parentNode) {
						if (el.id && el.id.match(HASH_PREFIX_REGEXP)) {
							li.id = el.id + '-' + li.getAttribute('index')
							break
						}
					}
				}
			})
		})
	}

	function forEach(array, func) {
		if (!array) { return }
		Array.prototype.forEach.call(array, func)
	}

})