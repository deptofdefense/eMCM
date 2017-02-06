document.querySelector('[data-no-results]').style.display = 'none'

$(function() {
	var navItemProto = document.querySelector('[data-nav-proto]')
	var subNavProto = document.querySelector('[data-subnav-proto]')
	var content = document.querySelector('[data-content]')

	var asidesContainer = document.querySelector('[data-asides]')
	var navContainer = navItemProto.parentNode
	navContainer.removeChild(navItemProto)
	subNavProto.parentNode.removeChild(subNavProto)

	var searchIndex = elasticlunr(function() {
		this.addField('title')
		this.addField('content')
		this.setRef('id')
	})
	window.searchIndex = searchIndex

	fetch('toc.json', function(json) {
		window.MCM = JSON.parse(json)

		var timeout = 0
		forEachRecursive(MCM, function(section, chain) {
			var title = titleForSection(section)
			var id = parameterize(idForChain(chain))

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

			var contentDiv = renderContentDiv(id)

			contentDiv.innerHTML = headerForSection(section)

			if (section.content) {
				searchIndex.addDoc({id: id, title: title, content: section.content})

				setTimeout(function() {
					contentDiv.innerHTML += contentize(section.content)
					fixListElements(contentDiv)
					fixDiscussionElements(contentDiv)
					fixTableElements(contentDiv)
				}, timeout)

				timeout += 10
			}
		})

		$('body').scrollspy({
			target: '[data-toc]',
			offset: 150
		})
	})

	var searchTimeout
	$('#searchbar').on('input', performSearch)

	function idForChain(chain) {
		var id = chain.map(function(section) {
			return section.type + '-' + (section.index || section._i)
		}).join('_')
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
			currentAnchorType = section.anchors
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
			if (currentAnchorType) result += "<a id=\"" + currentAnchorType + "-" + id + "\"></a>"
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
		var el = document.createElement('div')
		el.id = key
		content.appendChild(el)
		return el
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

	var LIST_REGEXP = /<(\/?)list/g
	var URL_REGEXP = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm
	var RCM_REGEXP = /R\.C\.M\.\s*(\d+)((\(\w+\))*)/ig
	var MILREVID_REGEXP = /Mil\.R\.Evid\.\s*(\d+)((\(\w+\))*)/ig
	function contentize(html) {
		return html.
			replace(LIST_REGEXP, '<$1ol').
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
		lists && lists.forEach(function(list) {
			Array.prototype.forEach.call(list.children, function(li) {
				var index = li.getAttribute('index')
				if (li.nodeName.toUpperCase() === 'LI' && index) {
					if (!list.type) {
						for (var listType in LIST_TYPES) {
							if (LIST_TYPES[listType].test(index)) {
								list.type = listType
							}
						}
					}

					if (list.type === '1') {
						li.value = parseInt(index)
					} else if (listType === 'a' || listType === 'A') {
						li.value = ALPHABET.indexOf(index.toLowerCase()) + 1
					}

					var parent = li
					while (parent = parent.parentNode) {
						var a = $(parent).children('a[id]')
						if (a.length) {
							var target = document.createElement('a')
							target.id = a[0].id + '-' + index
							li.insertBefore(target, li.firstChild)
							return
						}
					}
				}
			})
		})
	}

	function fixDiscussionElements(el) {
		var els = el.querySelectorAll('discussion')
		els && els.forEach(function(disc) {
			var parent = disc.parentNode
			disc.style.top = parent.offsetTop + 'px'
			asidesContainer.appendChild(disc)
		})
	}

	function fixTableElements(el) {
		var tables = el.querySelectorAll('table')
		tables && tables.forEach(function(table) {
			table.className += "table table-bordered table-condensed"
		})
	}

	var searchBar = document.getElementById('searchbar')
	var noResults = document.querySelector('[data-no-results]')
	var previousResults = []
	function performSearch() {
		var results = searchIndex.search(searchBar.value)
		var hrefs = results.map(function(result) { return '#' + result.ref }).sort()

		noResults.style.display = searchBar.value && !results.length ? 'block' : 'none'
		content.style.display = !searchBar.value || results.length ? 'block' : 'none'
		asidesContainer.style.display = !searchBar.value || results.length ? 'block' : 'none'

		document.querySelectorAll('.toc .nav li a').forEach(function(a) {
			var isVisible = !searchBar.value || hrefs.indexOf(a.getAttribute('href')) !== -1
			a.parentNode.style.display = isVisible ? 'block' : 'none'
			if (isVisible && searchBar.value) {
				while (a = a.parentNode) {
					if (a.nodeName === 'UL' || a.nodeName === 'LI')
						a.style.display = 'block'
				}
			}
		})

		// var spanRegexp = /<span class="search-result">([^<])<\/span>/gi
		// console.log(previousResults)
		// previousResults.forEach(function(result) {
		// 	var target = document.getElementById(result.ref)
		// 	target.innerHTML = target.innerHTML.replace(spanRegexp, "$&")
		// })

		// if (results.length) {
		// 	var regexp = new RegExp(searchBar.value, 'gi')
		// 	hrefs.forEach(function(href, i) {
		// 		var target = document.getElementById(href.substr(1))
		// 		target.innerHTML = target.innerHTML.replace(regexp, "<span class='search-result'>$&</span>")

		// 		if (i === 0) {
		// 			window.scrollTo(0, target.offsetTop - 40)
		// 		}
		// 	})
		// }

		// previousResults = results
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
})