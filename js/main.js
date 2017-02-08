$(function() {
	var navItemProto = document.querySelector('[data-nav-proto]')
	var subNavProto = document.querySelector('[data-subnav-proto]')
	var content = document.querySelector('[data-content]')

	var navContainer = navItemProto.parentNode
	navContainer.removeChild(navItemProto)
	subNavProto.parentNode.removeChild(subNavProto)

	var searchIndex = elasticlunr(function() {
		this.addField('_title', {boost: 5})
		this.addField('content')
		this.setRef('arrayIndex')
		this.saveDocument(false)
	})
	window.searchIndex = searchIndex

	fetch('toc.json', function(json) {
		window.MCM = JSON.parse(json)
		window.MCMflat = flattenArray(MCM, 'children')

		forEachRecursive(MCM, function(section, chain) {
			var title = section._title = titleForSection(section)
			var id = section._id = idForChain(chain)

			if (chain.length > 1) var parent = chain[chain.length - 2]

			if (chain.length < 4) {
				section.navItem = renderNavItem(title, id)
				if (parent) {
					if (!parent.subNav) {
						parent.subNav = subNavProto.cloneNode(true)
						parent.navItem.appendChild(parent.subNav)
					}

					parent.subNav.appendChild(section.navItem)
				} else {
					navContainer.appendChild(section.navItem)
				}
			}

			section.node = renderContentDiv(id)
		})

		renderViewableRangeForSection(MCMflat[0])

		$('body').scrollspy({
			target: '[data-toc]',
			offset: 180
		})

		var scroller = new FastScroll()
		scroller.on('scroll:progress', function(event) {
			if (scroller.directionY < 0) {
				var index = MCMflat.indexOf(firstRenderedSection)
				var firstNode = firstRenderedSection.node
				if (index > 0 && scroller.y < firstNode.offsetTop + firstNode.offsetHeight) {
					firstRenderedSection = MCMflat[index - 1]
					var newNode = renderSection(firstRenderedSection)
					document.body.scrollTop += newNode.offsetHeight
				}
			} else {
				var index = MCMflat.indexOf(lastRenderedSection)
				if (index < MCMflat.length - 1 && scroller.y + window.innerHeight > lastRenderedSection.node.offsetTop) {
					lastRenderedSection = MCMflat[index + 1]
					renderSection(lastRenderedSection)
				}
			}
		})

		window.onhashchange = function(event) {
			if (event) {
				event.preventDefault()
				event.stopPropagation()
			}

			// clear search results if we have any
			if (cachedContent) {
				searchBar.value = ''
				performSearch()
			}

			var hash = location.hash.substr(1)
			if (hash.indexOf('rcm-') === 0) {
				var fullHash = hash
				hash = hash.match(/(rcm-\d+)/)[1]
			}

			for (var i = 0, count = MCMflat.length; i < count; i++) {
				var section = MCMflat[i]
				if (section._id === hash) {
					renderViewableRangeForSection(section, false)
					if (fullHash) {
						setTimeout(function() {
							var targetElement = document.getElementById(fullHash)
							if (targetElement) {
								targetElement.scrollIntoView(true)
								document.body.scrollTop -= 160
							}
						})
					}

					return
				}
			}
		}

		if (location.hash.length > 1) {
			window.onhashchange()
		}

		setTimeout(function() {
			forEach(MCMflat, function(section, i) {
				if (section.content) {
					section.arrayIndex = i
					searchIndex.addDoc(section)
				}
			})
		}, 100)
	})

	document.getElementById('searchbar').addEventListener('input', performSearch)

	function renderSection(section, contentDiv) {
		contentDiv = contentDiv || section.node
		if (!contentDiv.firstChild) {
			contentDiv.innerHTML = headerForSection(section)

			if (section.content) {
				contentDiv.innerHTML += contentize(section.content)
				fixListElements(contentDiv)
				fixDiscussionElements(contentDiv)
				fixTableElements(contentDiv)
			}
		}

		return contentDiv
	}

	var firstRenderedSection
	var lastRenderedSection

	function renderViewableRangeForSection(section, jumpTo) {
		var index = MCMflat.indexOf(section)
		if (index > 0) {
			firstRenderedSection = MCMflat[index - 1]
			renderSection(firstRenderedSection)
		} else {
			firstRenderedSection = section
		}

		var lastNode = renderSection(section)
		if (jumpTo !== false) {
			setTimeout(function(lastNode) {
				document.body.scrollTop = lastNode.offsetTop - 80
			}.bind(null, lastNode))
		}

		lastRenderedSection = section

		while (index < MCMflat.length - 1 && (
				document.body.scrollTop + window.innerHeight > lastNode.offsetTop ||
				lastNode.offsetHeight < 150
			)) {
				lastRenderedSection = MCMflat[++index]
				lastNode = renderSection(lastRenderedSection)
			}

		$('body').scrollspy('refresh')
	}

	function idForChain(chain) {
		var section = chain[chain.length - 1]
		if (section.type === 'part')
			currentAnchorType = section.anchors

		var id
		if (currentAnchorType && chain.length > 2) {
			id = currentAnchorType + '-' + chain.slice(2).map(function(subsection) {return subsection.index}).join('-')
		} else {
			id = chain.map(function(section) {
				return section.type + '-' + (section.index || section._i)
			}).join('_')
		}

		return parameterize(id)
	}

	var ROMAN_TITLE_TYPES = {
		'part': ' - ',
		'chapter': '. '
	}

	function titleForSection(section) {
		var romanSeparator = ROMAN_TITLE_TYPES[section.type]
		if (romanSeparator && section.index) {
			return romanize(section.index) + romanSeparator + section.title
		}

		if (section.type === 'rule') {
			return section.index + '. ' + section.title
		} else if (section.type === 'article') {
			return section.index + '&ndash;' + section.title
		} else if (section.type === 'appendix') {
			return (section.index) + '. ' + section.title
		}

		return section.title
	}

	var currentAnchorType
	function headerForSection(section) {
		var result
		var id = parseInt(section.index)
		if (section.type === 'part') {
			result = "<h1>"
			if (id) result += "PART " + romanize(id) + "<br>"
			result += section.title.toUpperCase()
			result += "</h1>"
		} else if (section.type === 'chapter') {
			result = "<h1>"
			result += "CHAPTER " + romanize(id) + ". " + section.title.toUpperCase()
			result += "</h1>"
		} else if (section.type === 'rule') {
			result = "<h3>Rule " + id + ". " + section.title + "</h3>"
			// if (currentAnchorType) result += "<a id=\"" + currentAnchorType + "-" + id + "\"></a>"
		} else if (section.type === 'article') {
			result = "<h3>Article " + id + "&mdash;" + section.title + "</h3>"
		} else if (section.type === 'appendix') {
			result = "<h1>APPENDIX " + id + "<br>"
			result += section.title.toUpperCase()
			result += "</h1>"
		} else {
			result = "<h3>" + section.title + "</h3>"
		}
		return result
	}

	function renderContentDiv(key) {
		var row = document.createElement('div')
		row.className = 'row'
		row.id = key

		var col = document.createElement('div')
		col.className = 'col-xs-10'
		row.appendChild(col)
		content.appendChild(row)

		return col
	}

	function renderNavItem(title, href) {
		var item = navItemProto.cloneNode(true)
		item.querySelector('[data-title]').innerHTML = title
		item.querySelector('[data-target]').href = '#' + href
		return item
	}

	function fetch(url, callback) {
		var request = new XMLHttpRequest()
		request.addEventListener('load', function() {callback(this.responseText)})
		request.open('GET', url)
		request.send()
	}

	function parameterize(string) {
		return string.trim().replace(/[\s|-]+/g, '-').split(/[^\w|-]/)[0].toLowerCase()
	}

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
						if (el.id && el.id.indexOf('rcm-') === 0) {
							li.id = el.id + '-' + li.getAttribute('index')
							break
						}
					}
				}
			})
		})
	}

	function fixDiscussionElements(el) {
		var els = el.querySelectorAll('discussion')
		forEach(els, function(disc) {
			var row = document.createElement('div')
			row.className = 'row'

			var referenceNode = disc.parentNode
			referenceNode.parentNode.insertBefore(row, referenceNode)

			var col = document.createElement('div')
			col.className = 'col-xs-7'
			col.appendChild(referenceNode)
			row.appendChild(col)

			var newCol = document.createElement('div')
			newCol.className = 'col-xs-5'
			newCol.appendChild(disc)
			row.appendChild(newCol)
		})
	}

	function fixTableElements(el) {
		var tables = el.querySelectorAll('table')
		forEach(tables, function(table) {
			table.className += "table table-bordered table-condensed"
		})
	}

	var searchBar = document.getElementById('searchbar')
	var noResults = document.querySelector('[data-no-results]')

	var cachedContent
	function performSearch() {
		var query = searchBar.value

		if (!query && cachedContent) {
			content.innerHTML = ''
			content.appendChild(cachedContent)
			content = cachedContent
			cachedContent = null
		} else if (query) {
			var results = searchIndex.search(query).sort().map(function(result) { return MCMflat[result.ref] })
			var hrefs = results.map(function(result) { return '#' + result._id })
		}

		if (query && !cachedContent) {
			cachedContent = content
			content = content.parentNode
			content.removeChild(cachedContent)
		} else if (results) {
			content.innerHTML = ""
		}

		noResults.style.display = query && !results.length ? 'block' : 'none'

		forEach(document.querySelectorAll('.toc .nav li a'), function(a) {
			var isVisible = !query || hrefs.indexOf(a.getAttribute('href')) !== -1
			a.parentNode.style.display = isVisible ? 'block' : 'none'
			if (isVisible && query) {
				while (a = a.parentNode) {
					if (a.nodeName === 'UL' || a.nodeName === 'LI')
						a.style.display = 'block'
				}
			}
		})

		// render highlighted results
		if (results && results.length) {
			forEach(results, function(section) {
				var index = section.content.indexOf(query)
				if (index === -1)
					return

				var node = document.createElement('div')
				node.className = 'search-result'
				node.innerHTML += headerForSection(section)
				node.addEventListener('click', function() {
					location.hash = section._id
				})

				var html = ''
				if (index > 50) {
					var lastTagIndex = section.content.lastIndexOf('>', index - 50) + 1
					html += section.content.substr(lastTagIndex, index - lastTagIndex)
				} else {
					html += section.content.substr(Math.max(index - 200, 0), 200)
				}

				html += "<span class=\"highlight\">" + query + "</span>"

				var nextTagIndex = section.content.indexOf('<', index + query.length + 50)
				if (nextTagIndex) {
					html += section.content.substr(index + query.length, nextTagIndex - (index + query.length))
				} else {
					html += section.content.substr(index + query.length, 200)
				}

				node.innerHTML += contentize(html)

				content.appendChild(node)
			})

			document.body.scrollTop = 0
		}
	}

	function romanizeTitle(title) {
		var comps = title.split(' - ')
		if (comps.length > 1) {
			var romanized = [romanize(comps[0])]
			if (!romanized[0]) romanized.pop()

			romanized.push(comps[1])
			return romanized.join(' - ')
		} else { return comps[0] }
	}

	function romanize(num) {
		var lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i
		for (i in lookup) {
			while (num >= lookup[i]) {
				roman += i
				num -= lookup[i]
			}
		}

		return roman
	}

	function forEachRecursive(array, func, chain) {
		if (!chain) chain = []

		array.forEach(function(object, i) {
			object._i = i
			var newChain = chain.concat(object)
			func(object, newChain)
			if (object.children) {
				forEachRecursive(object.children, func, newChain)
			}
		})
	}

	function flattenArray(array, childrenKey, result) {
		if (!array) { return result }
		if (!result) { result = [] }

		forEach(array, function(object) {
			result.push(object)

			var children = childrenKey ? object[childrenKey] : object
			if (Array.isArray(children)) {
				flattenArray(children, childrenKey, result)
			}
		})

		return result
	}

	function forEach(array, func) {
		if (!array) { return }
		Array.prototype.forEach.call(array, func)
	}
})
